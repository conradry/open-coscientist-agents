-- Migration 001: Initial Database Schema
-- This migration creates the core schema for the medical research platform
-- Performance optimized for 60ms average response times

-- Enable WAL mode for better concurrent access
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = MEMORY;
PRAGMA mmap_size = 268435456; -- 256MB

-- Create migration tracking table
CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    description TEXT,
    executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Users table with medical research specific fields
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    institution TEXT,
    department TEXT,
    research_interests TEXT, -- JSON array of research areas
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

-- Papers table optimized for medical literature
CREATE TABLE IF NOT EXISTS papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT NOT NULL, -- JSON array of authors with affiliations
    doi TEXT UNIQUE,
    pmid TEXT UNIQUE,
    journal TEXT,
    publication_date DATE,
    volume TEXT,
    issue TEXT,
    pages TEXT,
    keywords TEXT, -- JSON array of medical keywords
    categories TEXT, -- JSON array of medical categories (e.g., "Cardiology", "Oncology")
    full_text_url TEXT,
    pdf_url TEXT,
    open_access BOOLEAN DEFAULT FALSE,
    citation_count INTEGER DEFAULT 0,
    altmetric_score REAL DEFAULT 0.0,
    language TEXT DEFAULT 'en',
    license TEXT,
    funding TEXT, -- JSON array of funding sources and grants
    conflicts_interest TEXT,
    peer_reviewed BOOLEAN DEFAULT TRUE,
    publication_type TEXT DEFAULT 'article' CHECK (publication_type IN ('article', 'review', 'meta-analysis', 'case-report', 'clinical-trial', 'preprint')),
    status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'submitted', 'under-review', 'published', 'retracted')),
    clinical_trial_id TEXT, -- For clinical trial papers
    medical_specialty TEXT, -- Primary medical specialty
    study_type TEXT, -- e.g., "Randomized Controlled Trial", "Cohort Study"
    sample_size INTEGER,
    metadata TEXT, -- JSON for additional paper data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search optimization for medical literature
CREATE VIRTUAL TABLE IF NOT EXISTS papers_fts USING fts5(
    title,
    abstract,
    authors,
    keywords,
    medical_specialty,
    content='papers',
    content_rowid='id',
    tokenize='porter unicode61 remove_diacritics 1'
);

-- Automated FTS index maintenance
CREATE TRIGGER IF NOT EXISTS papers_fts_insert AFTER INSERT ON papers BEGIN
    INSERT INTO papers_fts(rowid, title, abstract, authors, keywords, medical_specialty)
    VALUES (new.id, new.title, new.abstract, new.authors, new.keywords, new.medical_specialty);
END;

CREATE TRIGGER IF NOT EXISTS papers_fts_delete AFTER DELETE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, authors, keywords, medical_specialty)
    VALUES ('delete', old.id, old.title, old.abstract, old.authors, old.keywords, old.medical_specialty);
END;

CREATE TRIGGER IF NOT EXISTS papers_fts_update AFTER UPDATE ON papers BEGIN
    INSERT INTO papers_fts(papers_fts, rowid, title, abstract, authors, keywords, medical_specialty)
    VALUES ('delete', old.id, old.title, old.abstract, old.authors, old.keywords, old.medical_specialty);
    INSERT INTO papers_fts(rowid, title, abstract, authors, keywords, medical_specialty)
    VALUES (new.id, new.title, new.abstract, new.authors, new.keywords, new.medical_specialty);
END;

-- User collections for research organization
CREATE TABLE IF NOT EXISTS user_collections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT DEFAULT 'reading-list' CHECK (type IN ('reading-list', 'favorites', 'research-project', 'teaching', 'patient-care', 'literature-review', 'other')),
    is_public BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    paper_count INTEGER DEFAULT 0,
    metadata TEXT, -- JSON for additional collection data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Collection papers relationship with medical context
CREATE TABLE IF NOT EXISTS collection_papers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    collection_id INTEGER NOT NULL,
    paper_id INTEGER NOT NULL,
    added_by INTEGER NOT NULL,
    notes TEXT,
    tags TEXT, -- JSON array of user-specific medical tags
    clinical_relevance TEXT, -- User's assessment of clinical relevance
    order_index INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collection_id) REFERENCES user_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (added_by) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(collection_id, paper_id)
);

-- Enhanced reading history with medical context
CREATE TABLE IF NOT EXISTS reading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    paper_id INTEGER NOT NULL,
    read_time INTEGER DEFAULT 0, -- minutes spent reading
    read_percentage REAL DEFAULT 0.0, -- percentage of paper read
    last_position TEXT, -- JSON with scroll position or page number
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    clinical_applicability TEXT, -- Assessment of clinical applicability
    evidence_level TEXT, -- User's assessment of evidence level
    is_favorite BOOLEAN DEFAULT FALSE,
    metadata TEXT, -- JSON for additional reading data
    first_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(user_id, paper_id)
);

-- Medical-specific citations and references
CREATE TABLE IF NOT EXISTS citations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    citing_paper_id INTEGER NOT NULL,
    cited_paper_id INTEGER NOT NULL,
    citation_text TEXT,
    citation_type TEXT DEFAULT 'formal' CHECK (citation_type IN ('formal', 'informal', 'self-citation', 'data', 'method', 'clinical-guideline')),
    context TEXT, -- JSON with citation context
    medical_relevance TEXT, -- Medical context of citation
    metadata TEXT, -- JSON for additional citation data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (citing_paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    FOREIGN KEY (cited_paper_id) REFERENCES papers(id) ON DELETE CASCADE,
    UNIQUE(citing_paper_id, cited_paper_id)
);

-- Enhanced paper reviews with medical evaluation criteria
CREATE TABLE IF NOT EXISTS paper_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    paper_id INTEGER NOT NULL,
    reviewer_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    pros TEXT, -- JSON array of pros
    cons TEXT, -- JSON array of cons
    methodology_score INTEGER CHECK (methodology_score >= 1 AND methodology_score <= 5),
    clarity_score INTEGER CHECK (clarity_score >= 1 AND clarity_score <= 5),
    relevance_score INTEGER CHECK (relevance_score >= 1 AND relevance_score <= 5),
    clinical_impact_score INTEGER CHECK (clinical_impact_score >= 1 AND clinical_impact_score <= 5),
    statistical_power_score INTEGER CHECK (statistical_power_score >= 1 AND statistical_power_score <= 5),
    evidence_strength TEXT CHECK (evidence_strength IN ('strong', 'moderate', 'weak', 'insufficient')),
    is_recommended BOOLEAN DEFAULT FALSE,
    is_clinically_relevant BOOLEAN DEFAULT FALSE,
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

-- Search queries with medical context tracking
CREATE TABLE IF NOT EXISTS search_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    query TEXT NOT NULL,
    filters TEXT, -- JSON with applied filters
    results_count INTEGER DEFAULT 0,
    click_through_rate REAL DEFAULT 0.0,
    session_id TEXT,
    ip_address TEXT,
    user_agent TEXT,
    search_context TEXT, -- Medical context of the search
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Performance indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_users_medical_specialty ON users(json_extract(metadata, '$.primary_specialty'));

CREATE INDEX IF NOT EXISTS idx_papers_title ON papers(title);
CREATE INDEX IF NOT EXISTS idx_papers_doi ON papers(doi);
CREATE INDEX IF NOT EXISTS idx_papers_pmid ON papers(pmid);
CREATE INDEX IF NOT EXISTS idx_papers_journal ON papers(journal);
CREATE INDEX IF NOT EXISTS idx_papers_publication_date ON papers(publication_date);
CREATE INDEX IF NOT EXISTS idx_papers_medical_specialty ON papers(medical_specialty);
CREATE INDEX IF NOT EXISTS idx_papers_clinical_trial_id ON papers(clinical_trial_id);
CREATE INDEX IF NOT EXISTS idx_papers_citation_count ON papers(citation_count DESC);
CREATE INDEX IF NOT EXISTS idx_papers_publication_type ON papers(publication_type);
CREATE INDEX IF NOT EXISTS idx_papers_study_type ON papers(study_type);

CREATE INDEX IF NOT EXISTS idx_user_collections_user_id ON user_collections(user_id);
CREATE INDEX IF NOT EXISTS idx_user_collections_type ON user_collections(type);
CREATE INDEX IF NOT EXISTS idx_user_collections_is_public ON user_collections(is_public);

CREATE INDEX IF NOT EXISTS idx_collection_papers_collection_id ON collection_papers(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_papers_paper_id ON collection_papers(paper_id);
CREATE INDEX IF NOT EXISTS idx_collection_papers_added_by ON collection_papers(added_by);

CREATE INDEX IF NOT EXISTS idx_reading_history_user_id ON reading_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_paper_id ON reading_history(paper_id);
CREATE INDEX IF NOT EXISTS idx_reading_history_last_accessed_at ON reading_history(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reading_history_rating ON reading_history(rating);
CREATE INDEX IF NOT EXISTS idx_reading_history_clinical_applicability ON reading_history(clinical_applicability);

CREATE INDEX IF NOT EXISTS idx_citations_citing_paper_id ON citations(citing_paper_id);
CREATE INDEX IF NOT EXISTS idx_citations_cited_paper_id ON citations(cited_paper_id);
CREATE INDEX IF NOT EXISTS idx_citations_type ON citations(citation_type);

CREATE INDEX IF NOT EXISTS idx_paper_reviews_paper_id ON paper_reviews(paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_reviewer_id ON paper_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_rating ON paper_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_evidence_strength ON paper_reviews(evidence_strength);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_clinical_impact_score ON paper_reviews(clinical_impact_score DESC);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_created_at ON paper_reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_paper_reviews_status ON paper_reviews(status);

CREATE INDEX IF NOT EXISTS idx_search_queries_user_id ON search_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_search_queries_query ON search_queries(query);
CREATE INDEX IF NOT EXISTS idx_search_queries_created_at ON search_queries(created_at);

-- Partial indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_active_email ON users(email) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_papers_published_recent ON papers(publication_date DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_papers_clinical_trials ON papers(clinical_trial_id) WHERE clinical_trial_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reading_history_recent ON reading_history(last_accessed_at DESC) WHERE last_accessed_at > datetime('now', '-30 days');

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_papers_journal_date ON papers(journal, publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_papers_specialty_date ON papers(medical_specialty, publication_date DESC);
CREATE INDEX IF NOT EXISTS idx_collection_papers_order ON collection_papers(collection_id, order_index);
CREATE INDEX IF NOT EXISTS idx_search_queries_user_time ON search_queries(user_id, created_at DESC);

-- Performance triggers
CREATE TRIGGER IF NOT EXISTS update_collection_paper_count
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

CREATE TRIGGER IF NOT EXISTS update_paper_citation_count
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

CREATE TRIGGER IF NOT EXISTS update_user_activity
AFTER INSERT OR UPDATE ON reading_history
BEGIN
    UPDATE users
    SET last_login = CURRENT_TIMESTAMP
    WHERE id = IFNULL(NEW.user_id, OLD.user_id);
END;

-- Record this migration
INSERT INTO migrations (version, description) VALUES ('001_initial_schema', 'Initial database schema for medical research platform');

-- Initialize system configuration
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'boolean', 'json')),
    is_public BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial system configuration for medical research platform
INSERT OR IGNORE INTO system_config (key, value, description, data_type, is_public) VALUES
('app_version', '1.0.0', 'Application version', 'string', true),
('platform_name', 'MedLit Research Platform', 'Platform name', 'string', true),
('max_upload_size', '10485760', 'Maximum file upload size in bytes', 'integer', false),
('enable_analytics', 'true', 'Enable analytics tracking', 'boolean', false),
('maintenance_mode', 'false', 'Enable maintenance mode', 'boolean', true),
('default_page_size', '20', 'Default pagination size', 'integer', true),
('search_max_results', '1000', 'Maximum search results', 'integer', false),
('enable_clinical_trial_alerts', 'true', 'Enable clinical trial email alerts', 'boolean', false),
('cache_search_results_ttl', '300', 'Cache search results for 5 minutes', 'integer', false),
('max_reading_history_days', '365', 'Keep reading history for 365 days', 'integer', false);

-- Performance optimization settings
PRAGMA optimize;