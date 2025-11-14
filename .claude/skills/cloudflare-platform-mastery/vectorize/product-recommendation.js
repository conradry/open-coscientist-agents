/**
 * E-commerce Product Recommendation System
 * Vector-based product similarity and personalized recommendations
 */

export class ProductRecommendationEngine {
  constructor(env) {
    this.env = env;
    this.userCache = new Map();
    this.productCache = new Map();
  }

  /**
   * Get personalized product recommendations for user
   */
  async getPersonalizedRecommendations(params) {
    const {
      userId,
      strategy = 'hybrid',
      limit = 10,
      filters = {},
      context = {
        page: 'homepage',
        category: null,
        priceRange: null
      }
    } = params;

    try {
      const startTime = Date.now();

      // Step 1: Get user profile and behavior
      const userProfile = await this.getUserProfile(userId);

      // Step 2: Get user's current context
      const userContext = await this.getUserContext(userId, context);

      // Step 3: Generate recommendations based on strategy
      let recommendations = [];

      switch (strategy) {
        case 'collaborative':
          recommendations = await this.getCollaborativeRecommendations(userProfile, limit, filters);
          break;
        case 'content_based':
          recommendations = await this.getContentBasedRecommendations(userProfile, limit, filters);
          break;
        case 'popularity':
          recommendations = await this.getPopularityBasedRecommendations(userProfile, limit, filters);
          break;
        case 'hybrid':
        default:
          recommendations = await this.getHybridRecommendations(userProfile, userContext, limit, filters);
          break;
      }

      // Step 4: Apply business rules and filters
      const filteredRecommendations = this.applyBusinessRules(recommendations, filters, userProfile);

      // Step 5: Enrich with product details and scores
      const enrichedRecommendations = await this.enrichRecommendations(
        filteredRecommendations.slice(0, limit),
        userProfile
      );

      const processingTime = Date.now() - startTime;

      return {
        userId,
        strategy,
        recommendations: enrichedRecommendations,
        metadata: {
          processingTime,
          userProfile: {
            segments: userProfile.segments,
            preferences: userProfile.preferences?.slice(0, 3), // Top preferences
            recentCategories: userProfile.recentCategories?.slice(0, 5)
          },
          context,
          totalProcessed: recommendations.length,
          returned: enrichedRecommendations.length
        }
      };

    } catch (error) {
      console.error('Personalized recommendations failed:', error);
      throw new Error(`Failed to get personalized recommendations: ${error.message}`);
    }
  }

  /**
   * Get similar products for a given product
   */
  async getSimilarProducts(params) {
    const {
      productId,
      limit = 10,
      similarityThreshold = 0.6,
      filters = {},
      includeAttributes = true
    } = params;

    try {
      // Get product details
      const product = await this.getProductDetails(productId);
      if (!product) {
        throw new Error(`Product ${productId} not found`);
      }

      // Generate product embedding
      const productEmbedding = await this.generateProductEmbedding(product);

      // Find similar products using Vectorize
      const searchResults = await this.env.PRODUCT_VECTOR_INDEX.query(productEmbedding, {
        topK: limit * 2, // Get more for filtering
        namespace: 'products',
        returnVector: false,
        filter: this.buildProductFilter(filters, { excludeProduct: productId })
      });

      // Process and rank similar products
      const similarProducts = await Promise.all(
        searchResults.matches
          .filter(match => match.score >= similarityThreshold)
          .slice(0, limit)
          .map(async (match) => {
            const similarProduct = await this.getProductDetails(match.id);

            return {
              ...similarProduct,
              similarityScore: match.score,
              similarityFactors: await this.calculateSimilarityFactors(product, similarProduct),
              recommendationReason: this.generateSimilarityReason(product, similarProduct, match.score)
            };
          })
      );

      return {
        productId,
        product: {
          id: product.id,
          title: product.title,
          category: product.category,
          price: product.price,
          image: product.image
        },
        similarProducts,
        metadata: {
          totalFound: searchResults.matches.length,
          returned: similarProducts.length,
          similarityThreshold
        }
      };

    } catch (error) {
      console.error('Similar products search failed:', error);
      throw new Error(`Failed to get similar products: ${error.message}`);
    }
  }

  /**
   * Get collaborative filtering recommendations
   */
  async getCollaborativeRecommendations(userProfile, limit, filters) {
    try {
      // Find similar users based on behavior
      const similarUsers = await this.findSimilarUsers(userProfile.userId, 20);

      if (similarUsers.length === 0) {
        return [];
      }

      // Get products liked by similar users
      const candidateProducts = await this.getProductsFromSimilarUsers(
        userProfile.userId,
        similarUsers,
        100
      );

      // Rank products by collaborative filtering score
      const rankedProducts = await this.rankProductsCollaboratively(
        candidateProducts,
        userProfile,
        similarUsers
      );

      return rankedProducts.slice(0, limit * 2); // Get more for filtering

    } catch (error) {
      console.error('Collaborative recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get content-based recommendations
   */
  async getContentBasedRecommendations(userProfile, limit, filters) {
    try {
      // Get user's preferred products
      const preferredProducts = await this.getUserPreferredProducts(userProfile.userId, 10);

      if (preferredProducts.length === 0) {
        return [];
      }

      // Find products similar to user's preferences
      const contentCandidates = [];

      for (const preferredProduct of preferredProducts) {
        const similar = await this.getSimilarProducts({
          productId: preferredProduct.productId,
          limit: Math.ceil(limit / preferredProducts.length) + 2,
          filters
        });

        contentCandidates.push(...similar.similarProducts);
      }

      // Remove duplicates and rank
      const uniqueCandidates = this.removeDuplicateProducts(contentCandidates);
      const rankedCandidates = await this.rankProductsByContentRelevance(
        uniqueCandidates,
        userProfile
      );

      return rankedCandidates.slice(0, limit * 2);

    } catch (error) {
      console.error('Content-based recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get popularity-based recommendations
   */
  async getPopularityBasedRecommendations(userProfile, limit, filters) {
    try {
      // Get trending products
      const trendingProducts = await this.getTrendingProducts(
        userProfile.segments,
        limit * 3,
        filters
      );

      // Get top-rated products
      const topRatedProducts = await this.getTopRatedProducts(
        userProfile.segments,
        limit * 2,
        filters
      );

      // Get best-selling products
      const bestSellingProducts = await this.getBestSellingProducts(
        userProfile.segments,
        limit * 2,
        filters
      );

      // Combine and deduplicate
      const allPopular = [...trendingProducts, ...topRatedProducts, ...bestSellingProducts];
      const uniqueProducts = this.removeDuplicateProducts(allPopular);

      // Rank by popularity score
      const rankedProducts = uniqueProducts.map(product => ({
        ...product,
        popularityScore: this.calculatePopularityScore(product)
      }));

      return rankedProducts
        .sort((a, b) => b.popularityScore - a.popularityScore)
        .slice(0, limit * 2);

    } catch (error) {
      console.error('Popularity-based recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get hybrid recommendations combining multiple strategies
   */
  async getHybridRecommendations(userProfile, userContext, limit, filters) {
    try {
      // Get recommendations from different strategies
      const [collaborativeRecs, contentRecs, popularityRecs] = await Promise.all([
        this.getCollaborativeRecommendations(userProfile, limit, filters),
        this.getContentBasedRecommendations(userProfile, limit, filters),
        this.getPopularityBasedRecommendations(userProfile, limit, filters)
      ]);

      // Combine recommendations with weights
      const weights = this.calculateStrategyWeights(userProfile, userContext);

      const combinedRecs = this.combineRecommendations(
        [
          { recommendations: collaborativeRecs, weight: weights.collaborative, source: 'collaborative' },
          { recommendations: contentRecs, weight: weights.content, weight: weights.content, source: 'content' },
          { recommendations: popularityRecs, weight: weights.popularity, source: 'popularity' }
        ],
        userProfile
      );

      // Apply diversity and novelty
      const diversifiedRecs = this.applyDiversityAlgorithm(combinedRecs, userProfile, limit);

      return diversifiedRecs;

    } catch (error) {
      console.error('Hybrid recommendations failed:', error);
      return [];
    }
  }

  /**
   * Get user profile with preferences and behavior
   */
  async getUserProfile(userId) {
    // Check cache first
    if (this.userCache.has(userId)) {
      const cached = this.userCache.get(userId);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
        return cached.profile;
      }
    }

    try {
      // Get user data from D1
      const userData = await this.env.D1.prepare(`
        SELECT
          u.*,
          GROUP_CONCAT(DISTINCT uph.category) as categories,
          COUNT(DISTINCT uph.product_id) as product_count
        FROM users u
        LEFT JOIN user_product_history uph ON u.id = uph.user_id
        WHERE u.id = ?
        GROUP BY u.id
      `).bind(userId).first();

      if (!userData) {
        // Create default profile for new user
        const defaultProfile = {
          userId,
          segments: ['new_user'],
          preferences: [],
          behavior: {
            viewCount: 0,
            purchaseCount: 0,
            avgPrice: 0
          },
          recentCategories: [],
          created: Date.now()
        };

        this.userCache.set(userId, { profile: defaultProfile, timestamp: Date.now() });
        return defaultProfile;
      }

      // Get user segments
      const segments = await this.getUserSegments(userId);

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);

      const profile = {
        userId,
        segments: segments.map(s => s.name),
        preferences: preferences,
        behavior: {
          viewCount: userData.product_count || 0,
          purchaseCount: userData.purchase_count || 0,
          avgPrice: userData.avg_order_value || 0
        },
        recentCategories: userData.categories ? userData.categories.split(',') : [],
        registrationDate: userData.created_at,
        lastActive: userData.last_active
      };

      // Cache the profile
      this.userCache.set(userId, { profile, timestamp: Date.now() });

      return profile;

    } catch (error) {
      console.error('Failed to get user profile:', error);
      return {
        userId,
        segments: ['default'],
        preferences: [],
        behavior: { viewCount: 0, purchaseCount: 0, avgPrice: 0 },
        recentCategories: []
      };
    }
  }

  /**
   * Get user's current context
   */
  async getUserContext(userId, context) {
    try {
      // Get recent browsing history
      const recentHistory = await this.env.D1.prepare(`
        SELECT product_id, category, action, timestamp
        FROM user_product_history
        WHERE user_id = ? AND timestamp > datetime('now', '-7 days')
        ORDER BY timestamp DESC
        LIMIT 10
      `).bind(userId).all();

      // Get current session data
      const currentSession = await this.getCurrentSessionData(userId);

      return {
        ...context,
        recentHistory: recentHistory.results || [],
        currentSession,
        timeOfDay: new Date().getHours(),
        dayOfWeek: new Date().getDay()
      };

    } catch (error) {
      console.error('Failed to get user context:', error);
      return context;
    }
  }

  /**
   * Generate product embedding
   */
  async generateProductEmbedding(product) {
    try {
      // Combine product features into text for embedding
      const productText = [
        product.title || '',
        product.description || '',
        product.category || '',
        product.brand || '',
        product.attributes ? Object.values(product.attributes).join(' ') : '',
        product.tags ? product.tags.join(' ') : ''
      ].filter(Boolean).join(' ');

      const response = await this.env.AI.run('@cf/baai/bge-small-en-v1.5', {
        text: productText
      });

      return response.data[0];

    } catch (error) {
      console.error('Product embedding generation failed:', error);
      throw new Error(`Failed to generate product embedding: ${error.message}`);
    }
  }

  /**
   * Apply business rules to recommendations
   */
  applyBusinessRules(recommendations, filters, userProfile) {
    let filtered = [...recommendations];

    // Apply inventory filter
    if (filters.inStock !== false) {
      filtered = filtered.filter(rec => rec.inventory > 0);
    }

    // Apply price range filter
    if (filters.priceRange) {
      filtered = filtered.filter(rec =>
        rec.price >= filters.priceRange.min && rec.price <= filters.priceRange.max
      );
    }

    // Apply user-specific rules
    if (userProfile.segments?.includes('premium')) {
      // Premium users might see higher-priced items
      filtered = filtered.filter(rec => rec.price > 50);
    }

    // Remove products user already purchased
    if (filters.excludePurchased !== false) {
      // This would require checking user's purchase history
      // Implementation depends on your data structure
    }

    return filtered;
  }

  /**
   * Enrich recommendations with additional data
   */
  async enrichRecommendations(recommendations, userProfile) {
    return Promise.all(
      recommendations.map(async (rec, index) => {
        const enriched = {
          ...rec,
          recommendationScore: rec.score || rec.similarityScore || rec.popularityScore,
          position: index + 1,
          personalizationScore: this.calculatePersonalizationScore(rec, userProfile),
          urgencyFactors: this.calculateUrgencyFactors(rec),
          socialProof: await this.getSocialProof(rec.id)
        };

        // Add recommendation reasoning
        enriched.reason = this.generateRecommendationReason(enriched, userProfile);

        return enriched;
      })
    );
  }

  /**
   * Remove duplicate products
   */
  removeDuplicateProducts(products) {
    const seen = new Set();
    return products.filter(product => {
      if (seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    });
  }

  /**
   * Build product filter for Vectorize
   */
  buildProductFilter(filters, options = {}) {
    const vectorFilter = {};

    // Add standard filters
    if (filters.category) {
      vectorFilter.category = { $eq: filters.category };
    }

    if (filters.minPrice) {
      vectorFilter.price = { $gte: filters.minPrice };
    }

    if (filters.maxPrice) {
      vectorFilter.price = { ...(vectorFilter.price || {}), $lte: filters.maxPrice };
    }

    if (filters.brand) {
      vectorFilter.brand = { $eq: filters.brand };
    }

    // Exclude specific product
    if (options.excludeProduct) {
      vectorFilter.id = { $ne: options.excludeProduct };
    }

    return Object.keys(vectorFilter).length > 0 ? vectorFilter : undefined;
  }

  /**
   * Calculate strategy weights based on user profile
   */
  calculateStrategyWeights(userProfile, userContext) {
    const weights = {
      collaborative: 0.4,
      content: 0.3,
      popularity: 0.3
    };

    // Adjust weights based on user behavior
    if (userProfile.behavior.viewCount < 5) {
      // New user - lean more towards popularity
      weights.popularity = 0.6;
      weights.collaborative = 0.2;
      weights.content = 0.2;
    } else if (userProfile.behavior.purchaseCount > 10) {
      // Active user - lean more towards collaborative
      weights.collaborative = 0.5;
      weights.content = 0.3;
      weights.popularity = 0.2;
    }

    return weights;
  }

  /**
   * Combine recommendations from multiple strategies
   */
  combineRecommendations(strategyResults, userProfile) {
    const combined = new Map();

    for (const { recommendations, weight, source } of strategyResults) {
      for (const rec of recommendations) {
        if (combined.has(rec.id)) {
          const existing = combined.get(rec.id);
          existing.score += (rec.score || rec.similarityScore || 0) * weight;
          existing.sources.push(source);
        } else {
          combined.set(rec.id, {
            ...rec,
            score: (rec.score || rec.similarityScore || 0) * weight,
            sources: [source]
          });
        }
      }
    }

    return Array.from(combined.values())
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply diversity algorithm to recommendations
   */
  applyDiversityAlgorithm(recommendations, userProfile, targetCount) {
    if (recommendations.length <= targetCount) {
      return recommendations;
    }

    const diverse = [];
    const usedCategories = new Set();

    // First pass: ensure category diversity
    for (const rec of recommendations) {
      if (diverse.length >= targetCount) break;

      if (!usedCategories.has(rec.category)) {
        diverse.push(rec);
        usedCategories.add(rec.category);
      }
    }

    // Second pass: fill remaining slots with highest scored items
    for (const rec of recommendations) {
      if (diverse.length >= targetCount) break;

      if (!diverse.some(d => d.id === rec.id)) {
        diverse.push(rec);
      }
    }

    return diverse;
  }

  /**
   * Generate recommendation reason
   */
  generateRecommendationReason(recommendation, userProfile) {
    const reasons = [];

    if (recommendation.sources?.includes('collaborative')) {
      reasons.push('Customers with similar tastes also liked this');
    }

    if (recommendation.sources?.includes('content')) {
      reasons.push('Similar to items you\'ve viewed before');
    }

    if (recommendation.sources?.includes('popularity')) {
      reasons.push('Trending in your area');
    }

    if (recommendation.socialProof?.purchaseCount > 100) {
      reasons.push(`${recommendation.socialProof.purchaseCount} people bought this recently`);
    }

    if (recommendation.urgencyFactors?.lowStock) {
      reasons.push('Limited stock available');
    }

    return reasons.length > 0 ? reasons[0] : 'Recommended for you';
  }

  /**
   * Get product details from cache or database
   */
  async getProductDetails(productId) {
    // Check cache first
    if (this.productCache.has(productId)) {
      return this.productCache.get(productId);
    }

    try {
      const product = await this.env.D1.prepare(`
        SELECT * FROM products WHERE id = ?
      `).bind(productId).first();

      if (product) {
        // Parse JSON fields
        if (product.attributes) {
          product.attributes = JSON.parse(product.attributes);
        }
        if (product.tags) {
          product.tags = JSON.parse(product.tags);
        }

        // Cache the product
        this.productCache.set(productId, product);
      }

      return product;

    } catch (error) {
      console.error('Failed to get product details:', error);
      return null;
    }
  }
}