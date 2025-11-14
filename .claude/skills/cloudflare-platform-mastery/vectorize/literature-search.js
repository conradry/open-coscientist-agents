/**
 * Medical Literature Search Implementation
 * Based on successful medical research platform with PubMed integration
 * Combines semantic search with structured medical literature queries
 */

export class MedicalLiteratureSearch {
  constructor(env) {
    this.env = env;
    this.cache = new Map();
    this.cacheTimeout = 3600000; // 1 hour
  }

  /**
   * Comprehensive medical literature search
   */
  async searchMedicalLiterature(params) {
    const {
      query,
      searchConfig = {
        sources: ['pubmed', 'semantic', 'clinical_trials'],
        maxResults: 20,
        dateRange: 5, // years
        articleTypes: ['clinical_trial', 'review', 'meta_analysis'],
        specialties: [],
        includePreprints: false
      },
      filters = {
        openAccess: false,
        englishOnly: true,
        humansOnly: true,
        ageGroups: []
      }
    } = params;

    try {
      const startTime = Date.now();
      const searchId = this.generateSearchId();

      // Step 1: Query enhancement for medical domain
      const enhancedQuery = await this.enhanceMedicalQuery(query, searchConfig.specialties);

      // Step 2: Multi-source search orchestration
      const searchResults = await this.orchestrateMedicalSearch(
        enhancedQuery,
        searchConfig,
        filters,
        searchId
      );

      // Step 3: Result aggregation and ranking
      const aggregatedResults = await this.aggregateMedicalResults(
        searchResults,
        query,
        searchConfig
      );

      // Step 4: Medical relevance scoring
      const scoredResults = await this.scoreMedicalRelevance(
        aggregatedResults,
        query,
        searchConfig.specialties
      );

      // Step 5: Evidence quality assessment
      const qualityAssessedResults = await this.assessEvidenceQuality(scoredResults);

      const totalTime = Date.now() - startTime;

      return {
        searchId,
        query,
        enhancedQuery,
        results: qualityAssessedResults.slice(0, searchConfig.maxResults),
        metadata: {
          sources: searchConfig.sources,
          totalFound: aggregatedResults.length,
          returned: qualityAssessedResults.length,
          searchTime: totalTime,
          filters: filters,
          evidenceQualityDistribution: this.calculateQualityDistribution(qualityAssessedResults)
        }
      };

    } catch (error) {
      console.error('Medical literature search failed:', error);
      throw new Error(`Medical literature search failed: ${error.message}`);
    }
  },

  /**
   * Enhance query with medical terminology and MeSH terms
   */
  async enhanceMedicalQuery(query, specialties) {
    try {
      // Extract medical terms and concepts
      const medicalTerms = await this.extractMedicalTerms(query, this.env);

      // Get MeSH term suggestions
      const meshTerms = await this.getSuggestedMeshTerms(query, specialties, this.env);

      // Build synonyms and related terms
      const synonyms = await this.getMedicalSynonyms(medicalTerms, this.env);

      return {
        original: query,
        enhanced: this.buildEnhancedQuery(query, medicalTerms, meshTerms, synonyms),
        medicalTerms,
        meshTerms,
        synonyms
      };

    } catch (error) {
      console.error('Query enhancement failed:', error);
      return {
        original: query,
        enhanced: query,
        medicalTerms: [],
        meshTerms: [],
        synonyms: []
      };
    }
  },

  /**
   * Orchestrate search across multiple medical literature sources
   */
  async orchestrateMedicalSearch(enhancedQuery, searchConfig, filters, searchId) {
    const searchPromises = [];

    // Semantic search using Vectorize
    if (searchConfig.sources.includes('semantic')) {
      searchPromises.push(
        this.performSemanticSearch(enhancedQuery, searchConfig, filters, searchId)
          .catch(error => ({ source: 'semantic', error: error.message, results: [] }))
      );
    }

    // PubMed structured search
    if (searchConfig.sources.includes('pubmed')) {
      searchPromises.push(
        this.performPubMedSearch(enhancedQuery, searchConfig, filters, searchId)
          .catch(error => ({ source: 'pubmed', error: error.message, results: [] }))
      );
    }

    // Clinical trials search
    if (searchConfig.sources.includes('clinical_trials')) {
      searchPromises.push(
        this.performClinicalTrialsSearch(enhancedQuery, searchConfig, filters, searchId)
          .catch(error => ({ source: 'clinical_trials', error: error.message, results: [] }))
      );
    }

    // Preprint servers (medRxiv, bioRxiv)
    if (searchConfig.sources.includes('preprints') && searchConfig.includePreprints) {
      searchPromises.push(
        this.performPreprintSearch(enhancedQuery, searchConfig, filters, searchId)
          .catch(error => ({ source: 'preprints', error: error.message, results: [] }))
      );
    }

    const results = await Promise.all(searchPromises);
    return results;
  },

  /**
   * Perform semantic search using Vectorize with medical embeddings
   */
  async performSemanticSearch(enhancedQuery, searchConfig, filters, searchId) {
    try {
      // Generate query embedding
      const queryEmbedding = await this.generateMedicalEmbedding(
        enhancedQuery.enhanced,
        this.env
      );

      // Build medical-specific filter
      const medicalFilter = this.buildMedicalFilter(filters, searchConfig);

      // Search Vectorize index
      const searchResults = await this.env.MEDICAL_VECTOR_INDEX.query(queryEmbedding, {
        topK: searchConfig.maxResults * 2, // Get more for filtering
        namespace: 'medical_literature',
        returnVector: false,
        filter: medicalFilter
      });

      // Process and enhance results
      const processedResults = await Promise.all(
        searchResults.matches.map(async (match) => {
          const metadata = match.metadata || {};

          return {
            id: match.id,
            pmid: metadata.pmid,
            title: metadata.title,
            abstract: metadata.abstract,
            authors: JSON.parse(metadata.authors || '[]'),
            journal: metadata.journal,
            publication_date: metadata.publication_date,
            articleType: metadata.articleType,
            specialty: metadata.specialty,
            meshTerms: JSON.parse(metadata.meshTerms || '[]'),
            relevanceScore: match.score,
            source: 'semantic_vector',
            metadata: {
              doi: metadata.doi,
              openAccess: metadata.openAccess,
              language: metadata.language,
              publicationTypes: JSON.parse(metadata.publicationTypes || '[]')
            }
          };
        })
      );

      // Apply additional filtering
      const filteredResults = this.applyMedicalFilters(processedResults, filters, searchConfig);

      return {
        source: 'semantic',
        results: filteredResults,
        queryTime: Date.now()
      };

    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  },

  /**
   * Perform PubMed structured search using E-utilities
   */
  async performPubMedSearch(enhancedQuery, searchConfig, filters, searchId) {
    try {
      // Build PubMed search query
      const pubmedQuery = this.buildPubMedQuery(enhancedQuery, filters, searchConfig);

      // Search PubMed for article IDs
      const searchUrl = this.buildPubMedSearchUrl(pubmedQuery, searchConfig);
      const searchResponse = await fetch(searchUrl);
      const searchData = await searchResponse.json();

      const idList = searchData.esearchresult?.idlist || [];

      if (idList.length === 0) {
        return { source: 'pubmed', results: [] };
      }

      // Fetch detailed information
      const articles = await this.fetchPubMedDetails(idList.slice(0, searchConfig.maxResults));

      return {
        source: 'pubmed',
        results: articles,
        totalCount: searchData.esearchresult?.count || 0
      };

    } catch (error) {
      console.error('PubMed search failed:', error);
      throw error;
    }
  },

  /**
   * Perform clinical trials search
   */
  async performClinicalTrialsSearch(enhancedQuery, searchConfig, filters, searchId) {
    try {
      // Build clinical trials query
      const trialsQuery = this.buildClinicalTrialsQuery(enhancedQuery, filters);

      // Search ClinicalTrials.gov
      const trialsUrl = this.buildClinicalTrialsUrl(trialsQuery, searchConfig);
      const trialsResponse = await fetch(trialsUrl);
      const trialsData = await trialsResponse.json();

      // Process trial results
      const processedTrials = (trialsData.studies || []).map(study => ({
        id: study.protocolSection?.identificationModule?.nctId,
        title: study.protocolSection?.identificationModule?.briefTitle,
        description: study.protocolSection?.descriptionModule?.briefSummary,
        phase: study.protocolSection?.designModule?.phaseList?.[0]?.phase,
        status: study.protocolSection?.statusModule?.overallStatus,
        startDate: study.protocolSection->statusModule?.studyFirstPostDateStruct?.date,
        conditions: study.protocolSection?.conditionsModule?.conditions || [],
        interventions: study.protocolSection?.armsInterventionsModule?.interventions || [],
        source: 'clinical_trials',
        relevanceScore: this.calculateClinicalTrialRelevance(enhancedQuery.original, study)
      }));

      return {
        source: 'clinical_trials',
        results: processedTrials
      };

    } catch (error) {
      console.error('Clinical trials search failed:', error);
      throw error;
    }
  },

  /**
   * Aggregate and deduplicate results from multiple sources
   */
  async aggregateMedicalResults(searchResults, originalQuery, searchConfig) {
    const allResults = [];
    const seenIds = new Set();

    for (const sourceResult of searchResults) {
      if (sourceResult.error) {
        console.warn(`Source ${sourceResult.source} failed:`, sourceResult.error);
        continue;
      }

      for (const result of sourceResult.results) {
        const uniqueKey = result.pmid || result.id || `${sourceResult.source}_${result.title}`;

        if (!seenIds.has(uniqueKey)) {
          seenIds.add(uniqueKey);

          allResults.push({
            ...result,
            sources: [sourceResult.source],
            aggregationScore: result.relevanceScore || 0.5
          });
        } else {
          // Merge with existing result
          const existing = allResults.find(r => {
            const existingKey = r.pmid || r.id;
            return existingKey === (result.pmid || result.id);
          });

          if (existing) {
            existing.sources.push(sourceResult.source);
            existing.aggregationScore = Math.max(
              existing.aggregationScore,
              result.relevanceScore || 0.5
            );
          }
        }
      }
    }

    // Sort by aggregation score
    return allResults.sort((a, b) => b.aggregationScore - a.aggregationScore);
  },

  /**
   * Score medical relevance using domain-specific factors
   */
  async scoreMedicalRelevance(results, query, specialties) {
    for (const result of results) {
      const relevanceFactors = {
        titleMatch: this.calculateTitleRelevance(result.title, query),
        abstractRelevance: this.calculateAbstractRelevance(result.abstract, query),
        specialtyMatch: this.calculateSpecialtyMatch(result, specialties),
        publicationRecency: this.calculateRecencyScore(result.publication_date),
        journalQuality: this.calculateJournalQualityScore(result.journal),
        evidenceLevel: this.calculateEvidenceLevelScore(result)
      };

      // Calculate weighted medical relevance score
      result.medicalRelevanceScore = this.calculateWeightedMedicalRelevance(relevanceFactors);
      result.relevanceFactors = relevanceFactors;
    }

    return results.sort((a, b) => b.medicalRelevanceScore - a.medicalRelevanceScore);
  },

  /**
   * Assess evidence quality using medical hierarchy
   */
  async assessEvidenceQuality(results) {
    for (const result of results) {
      const qualityAssessment = {
        level: this.determineEvidenceLevel(result),
        bias: this.assessStudyBias(result),
        sampleSize: this.extractSampleSize(result),
        confidence: this.calculateEvidenceConfidence(result),
        limitations: this.identifyLimitations(result)
      };

      result.evidenceQuality = qualityAssessment;
      result.qualityScore = this.calculateOverallQualityScore(qualityAssessment);
    }

    return results.sort((a, b) => b.qualityScore - a.qualityScore);
  },

  /**
   * Extract medical terms from query
   */
  async extractMedicalTerms(query, env) {
    try {
      const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'Extract medical terms, conditions, treatments, and medications from the query. Return as JSON array.'
          },
          {
            role: 'user',
            content: `Query: ${query}`
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      });

      return JSON.parse(response.response || '[]');

    } catch (error) {
      console.error('Medical term extraction failed:', error);
      return [];
    }
  },

  /**
   * Generate medical-specific embedding
   */
  async generateMedicalEmbedding(text, env) {
    try {
      const response = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: text.trim()
      });
      return response.data[0];
    } catch (error) {
      console.error('Medical embedding generation failed:', error);
      throw new Error(`Failed to generate medical embedding: ${error.message}`);
    }
  },

  /**
   * Calculate title relevance score
   */
  calculateTitleRelevance(title, query) {
    if (!title || !query) return 0;

    const titleWords = title.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);

    const matches = queryWords.filter(word =>
      titleWords.some(titleWord => titleWord.includes(word) || word.includes(titleWord))
    );

    return matches.length / queryWords.length;
  },

  /**
   * Calculate abstract relevance score
   */
  calculateAbstractRelevance(abstract, query) {
    if (!abstract || !query) return 0;

    const abstractWords = abstract.toLowerCase().split(/\s+/);
    const queryWords = query.toLowerCase().split(/\s+/);

    const matches = queryWords.filter(word =>
      abstractWords.some(abstractWord => abstractWord.includes(word) || word.includes(abstractWord))
    );

    return Math.min(matches.length / (queryWords.length * 2), 1.0);
  },

  /**
   * Calculate specialty match
   */
  calculateSpecialtyMatch(result, specialties) {
    if (!specialties || specialties.length === 0) return 0.5;

    const resultSpecialty = result.specialty?.toLowerCase() || '';
    const resultMeshTerms = result.meshTerms || [];

    for (const specialty of specialties) {
      if (resultSpecialty.includes(specialty.toLowerCase()) ||
          resultMeshTerms.some(mesh => mesh.toLowerCase().includes(specialty.toLowerCase()))) {
        return 1.0;
      }
    }

    return 0.3;
  },

  /**
   * Calculate recency score
   */
  calculateRecencyScore(publicationDate) {
    if (!publicationDate) return 0.5;

    const pubDate = new Date(publicationDate);
    const now = new Date();
    const yearsDiff = (now - pubDate) / (365 * 24 * 60 * 60 * 1000);

    if (yearsDiff <= 1) return 1.0;
    if (yearsDiff <= 3) return 0.8;
    if (yearsDiff <= 5) return 0.6;
    if (yearsDiff <= 10) return 0.4;
    return 0.2;
  },

  /**
   * Calculate journal quality score
   */
  calculateJournalQualityScore(journal) {
    // Simplified journal quality scoring
    const highImpactJournals = [
      'new england journal of medicine',
      'lancet',
      'jama',
      'nature medicine',
      'cell',
      'science',
      'nature',
      'bmj'
    ];

    const mediumImpactJournals = [
      'annals of internal medicine',
      'archives of internal medicine',
      'journal of clinical investigation',
      'plos medicine',
      'bmj'
    ];

    const journalLower = journal?.toLowerCase() || '';

    if (highImpactJournals.some(j => journalLower.includes(j))) {
      return 1.0;
    }
    if (mediumImpactJournals.some(j => journalLower.includes(j))) {
      return 0.7;
    }
    return 0.5;
  },

  /**
   * Calculate evidence level score
   */
  calculateEvidenceLevelScore(result) {
    const articleType = (result.articleType || '').toLowerCase();
    const publicationTypes = result.metadata?.publicationTypes || [];

    // Systematic reviews and meta-analyses
    if (articleType.includes('meta_analysis') || articleType.includes('systematic_review')) {
      return 1.0;
    }

    // Randomized controlled trials
    if (articleType.includes('clinical_trial') ||
        publicationTypes.some(pt => pt.toLowerCase().includes('randomized'))) {
      return 0.9;
    }

    // Cohort studies
    if (articleType.includes('cohort')) {
      return 0.7;
    }

    // Case-control studies
    if (articleType.includes('case_control')) {
      return 0.6;
    }

    // Case series/reports
    if (articleType.includes('case') || articleType.includes('report')) {
      return 0.4;
    }

    // Reviews (non-systematic)
    if (articleType.includes('review')) {
      return 0.5;
    }

    return 0.3;
  },

  /**
   * Calculate weighted medical relevance
   */
  calculateWeightedMedicalRelevance(factors) {
    const weights = {
      titleMatch: 0.25,
      abstractRelevance: 0.20,
      specialtyMatch: 0.15,
      publicationRecency: 0.15,
      journalQuality: 0.15,
      evidenceLevel: 0.10
    };

    return Object.entries(factors).reduce((score, [factor, value]) => {
      return score + (value * (weights[factor] || 0));
    }, 0);
  },

  /**
   * Determine evidence level
   */
  determineEvidenceLevel(result) {
    const score = this.calculateEvidenceLevelScore(result);

    if (score >= 0.9) return 'Level I';
    if (score >= 0.7) return 'Level II';
    if (score >= 0.5) return 'Level III';
    if (score >= 0.3) return 'Level IV';
    return 'Level V';
  },

  /**
   * Generate unique search ID
   */
  generateSearchId() {
    return crypto.randomUUID();
  },

  /**
   * Calculate evidence quality distribution
   */
  calculateQualityDistribution(results) {
    const distribution = {};

    results.forEach(result => {
      const level = result.evidenceQuality?.level || 'Unknown';
      distribution[level] = (distribution[level] || 0) + 1;
    });

    return distribution;
  }
}