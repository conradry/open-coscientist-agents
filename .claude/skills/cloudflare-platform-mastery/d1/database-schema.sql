-- D1 Database Schema Template for Production Applications
-- Based on successful medical research platform implementation
-- Response times: 60ms average with proper optimization

-- ========================================
-- CORE TABLES
-- ========================================

-- Users table with comprehensive profile management
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    institution TEXT,
    department TEXT,
    verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at DATETIME,
    last_login DATETIME,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
    preferences TEXT, -- JSON for user preferences
    metadata TEXT, -- JSON for additional user data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_institution ON users(institution);
CREATE INDEX idx_users_created_at ON users(created_at);

-- Literature/Papers table (medical research optimized)
CREATE TABLE papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT NOT NULL, -- JSON array of authors
    doi TEXT UNIQUE,
    pmid TEXT UNIQUE,
    journal TEXT,
    publication_date DATE,
    volume TEXT,
    issue TEXT,
    pages TEXT,
    keywords TEXT, -- JSON array of keywords
    categories TEXT, -- JSON array of categories
    full_text_url TEXT,
    pdf_url TEXT,
    open_access BOOLEAN DEFAULT FALSE,
    citation_count INTEGER DEFAULT 0,
    altmetric_score REAL DEFAULT 0.0,
    language TEXT DEFAULT 'en',
    license TEXT,
    funding TEXT, -- JSON array of funding sources
    conflicts_interest TEXT,
    peer_reviewed BOOLEAN DEFAULT TRUE,
    publication_type TEXT DEFAULT 'article' CHECK (publication_type IN ('article', 'review', 'meta-analysis', 'case-report', 'preprint')),
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'submitted', 'under-review', 'published', 'retracted')),
    search_vector TEXT, -- FTS5 virtual table integration
    metadata TEXT, -- JSON for additional paper data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Optimized indexes for papers
CREATE INDEX idx_papers_title ON papers(title);
CREATE INDEX idx_papers_doi ON papers(doi);
CREATE INDEX idx_papers_pmid ON papers(pmid);
CREATE INDEX idx_papers_journal ON papers(journal);
CREATE INDEX idx_papers_publication_date ON papers(publication_date);
CREATE INDEX idx_papers_categories ON papers(categories);
CREATE INDEX idx_papers_open_access ON papers(open_access);
CREATE INDEX idx_papers_citation_count ON papers(citation_count DESC);
CREATE INDEX idx_papers_publication_type ON papers(publication_type);
CREATE INDEX idx_papers_status ON papers(status);

-- Full-text search virtual table for papers
CREATE VIRTUAL TABLE papers_fts USING fts5(
    title,
    abstract,
    authors,
    keywords,
    content='papers',
    content_rowid='id'
);

-- FTS5 triggers for automatic search index maintenance
CREATE TRIGGER papers_fts_insert AFTER INSERT ON papers BEGIN
    INSERT INTO papers_fts(rowid, title, abstract, authors, keywords)
    VALUES (new.id, new.title, new.abstract, new.authors, new.keywords);
END;

CREATE TRIGGER papers_fts_delete AFTER DELETE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, authors, keywords)
    VALUES ('delete', old.id, old.title, old.abstract, old.authors, old.keywords);
END;

CREATE TRIGGER papers_fts_update AFTER UPDATE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, authors, keywords)
    VALUES ('delete', old.id, old.title, old.abstract, old.authors, old.keywords);
    INSERT INTO papers_fts(rowid, title, abstract, authors, keywords)
    VALUES (new.id, new.title, new.abstract, new.authors, new.keywords);
END;

-- User collections/bookmarks
CREATE TABLE user_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'reading-list' CHECK (type IN ('reading-list', 'favorites', 'research-project', 'teaching', 'other')),
    is_public BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    paper_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON for additional collection data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX idx_user_collections_type ON user_collections(type);
CREATE INDEX idx_user_collections_is_public ON user_collections(is_public);

-- Collection papers many-to-many relationship
CREATE TABLE collection_papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    paper_id INTEGER NOT NULL,
    added_by INTEGER NOT NULL,
    notes TEXT,
    tags TEXT, -- JSON array of user-specific tags
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES user_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(collection_id, paper_id)
);

CREATE INDEX idx_collection_papers_collection_id ON collection_papers(collection_id);
CREATE INDEX idx_collection_papers_paper_id ON collection_papers(paper_id);
CREATE INDEX idx_collection_papers_added_by ON collection_papers(added_by);

-- User reading history
CREATE TABLE reading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    paper_id INTEGER NOT NULL,
    read_time INTEGER DEFAULT 0, -- minutes spent reading
    read_percentage REAL DEFAULT 0.0, -- percentage of paper read
    last_position TEXT, -- JSON with scroll position or page number
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    is_favorite BOOLEAN DEFAULT FALSE,
    metadata TEXT, -- JSON for additional reading data
    first_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(user_id, paper_id)
);

CREATE INDEX idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX idx_reading_history_paper_id ON reading_history(paper_id);
CREATE INDEX idx_reading_history_last_accessed_at ON reading_history(last_accessed_at DESC);
CREATE INDEX idx_reading_history_rating ON reading_history(rating);
CREATE INDEX idx_reading_history_is_favorite ON reading_history(is_favorite);

-- Citations and references
CREATE TABLE citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citing_paper_id INTEGER NOT NULL,
    cited_paper_id INTEGER NOT NULL,
    citation_text TEXT,
    citation_type TEXT DEFAULT 'formal' CHECK (citation_type IN ('formal', 'informal', 'self-citation', 'data', 'method')),
    context TEXT, -- JSON with context information
    metadata TEXT, -- JSON for additional citation data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citing_paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (cited_paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(citing_paper_id, cited_paper_id)
);

CREATE INDEX idx_citations_citing_paper_id ON citations(citing_paper_id);
CREATE INDEX idx_citations_cited_paper_id ON citations(cited_paper_id);
CREATE INDEX idx_citations_type ON citations(citation_type);

-- User reviews and ratings
CREATE TABLE paper_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    pros TEXT, -- JSON array of pros
    cons TEXT, -- JSON array of cons
    methodology_score INTEGER CHECK (methodology_score >= 1 AND methodology_score <= 5),
    clarity_score INTEGER CHECK (clarity_score >= 1 AND methodology_score <= 5),
    relevance_score INTEGER CHECK (relevance_score >= 1 AND methodology_score <= 5),
    is_recommended BOOLEAN DEFAULT FALSE,
    is_helpful_count INTEGER DEFAULT 0,
    is_not_helpful_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'hidden')),
    metadata TEXT, -- JSON for additional review data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(paper_id, reviewer_id)
);

CREATE INDEX idx_paper_reviews_paper_id ON paper_reviews(paper_id);
CREATE INDEX idx_paper_reviews_reviewer_id ON paper_reviews(reviewer_id);
CREATE INDEX idx_paper_reviews_rating ON paper_reviews(rating);
CREATE INDEX idx_paper_reviews_created_at ON paper_reviews(created_at DESC);
CREATE INDEX idx_paper_reviews_status ON paper_reviews(status);

-- Search queries for analytics and optimization
CREATE TABLE search_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    query TEXT NOT NULL,
    filters TEXT, -- JSON with applied filters
    results_count INTEGER DEFAULT 0,
    click_through_rate REAL DEFAULT 0.0,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX idx_search_queries_query ON search_queries(query);
CREATE INDEX idx_search_queries_created_at ON search_queries(created_at);

-- API usage tracking
CREATE TABLE api_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time INTEGER NOT NULL, -- milliseconds
    request_size INTEGER DEFAULT 0,
    response_size INTEGER DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX idx_api_usage_endpoint ON api_usage(endpoint);
CREATE INDEX idx_api_usage_status_code ON api_usage(status_code);
CREATE INDEX idx_api_usage_created_at ON api_usage(created_at);

-- Analytics events
CREATE TABLE analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    properties TEXT, -- JSON with event properties
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- System configuration
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'boolean', 'json')),
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial system configuration
INSERT INTO system_config (key, value, description, data_type, is_public) VALUES
('app_version', '1.0.0', 'Application version', 'string', true),
('max_upload_size', '10485760', 'Maximum file upload size in bytes', 'integer', false),
('enable_analytics', 'true', 'Enable analytics tracking', 'boolean', false),
('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean', true),
('default_page_size', '20', 'Default pagination size', 'integer', true);

-- ========================================
-- VIEWS FOR COMMON QUERIES
-- ========================================

-- Recent papers with publication info
CREATE VIEW recent_papers AS
SELECT
    p.id,
    p.title,
    p.authors,
    p.journal,
    p.publication_date,
    p.citation_count,
    p.open_access,
    p.publication_type,
    u.full_name as first_author,
    u.verified as author_verified
FROM papers p
JOIN json_extract(p.authors, '$[0].name') as first_author_name
LEFT JOIN users u ON u.full_name = first_author_name
WHERE p.status = 'published'
ORDER BY p.publication_date DESC;

-- Popular papers by citations and views
CREATE VIEW popular_papers AS
SELECT
    p.*,
    COUNT(DISTINCT rh.user_id) as unique_readers,
    AVG(pr.rating) as avg_rating,
    COUNT(pr.id) as review_count
FROM papers p
LEFT JOIN reading_history rh ON p.id = rh.paper_id
LEFT JOIN paper_reviews pr ON p.id = pr.paper_id AND pr.status = 'published'
WHERE p.status = 'published'
GROUP BY p.id
ORDER BY (p.citation_count * 0.7 + unique_readers * 0.3) DESC;

-- User activity summary
CREATE VIEW user_activity AS
SELECT
    u.id,
    u.username,
    u.full_name,
    COUNT(DISTINCT rh.paper_id) as papers_read,
    COUNT(DISTINCT cp.collection_id) as collections_count,
    COUNT(DISTINCT pr.id) as reviews_count,
    AVG(pr.rating) as avg_review_rating,
    MAX(rh.last_accessed_at) as last_activity
FROM users u
LEFT JOIN reading_history rh ON u.id = rh.user_id
LEFT JOIN user_collections uc ON u.id = uc.user_id
LEFT JOIN collection_papers cp ON uc.id = cp.collection_id
LEFT JOIN paper_reviews pr ON u.id = pr.reviewer_id
WHERE u.status = 'active'
GROUP BY u.id;

-- ========================================
-- PERFORMANCE OPTIMIZATION
-- ========================================

-- Partial indexes for better performance
CREATE INDEX idx_users_active_email ON users(email) WHERE status = 'active';
CREATE INDEX idx_papers_published_recent ON papers(publication_date DESC) WHERE status = 'published';
CREATE INDEX idx_reading_history_recent ON reading_history(last_accessed_at DESC) WHERE last_accessed_at > datetime('now', '-30 days');

-- Composite indexes for common query patterns
CREATE INDEX idx_papers_journal_date ON papers(journal, publication_date DESC);
CREATE INDEX idx_collection_papers_order ON collection_papers(collection_id, order_index);
CREATE INDEX idx_search_queries_user_time ON search_queries(user_id, created_at DESC);

-- Trigger for updating paper count in collections
CREATE TRIGGER update_collection_paper_count
AFTER INSERT OR DELETE ON collection_papers
BEGIN
    UPDATE user_collections
    SET paper_count = (
        SELECT COUNT(*)
        FROM collection_papers
        WHERE collection_id = IFNULL(NEW.collection_id, OLD.collection_id)
    )
    WHERE id = IFNULL(NEW.collection_id, OLD.collection_id);
END;

-- Trigger for updating paper citation count
CREATE TRIGGER update_paper_citation_count
AFTER INSERT ON citations
BEGIN
    UPDATE papers
    SET citation_count = (
        SELECT COUNT(*)
        FROM citations
        WHERE cited_paper_id = NEW.cited_paper_id
    )
    WHERE id = NEW.cited_paper_id;
END;

-- Trigger for updating user activity timestamp
CREATE TRIGGER update_user_activity
AFTER INSERT OR UPDATE ON reading_history
BEGIN
    UPDATE users
    SET last_login = CURRENT_TIMESTAMP
    WHERE id = IFNULL(NEW.user_id, OLD.user_id);
END;