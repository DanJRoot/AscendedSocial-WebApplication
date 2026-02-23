import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { insertPostSchema, insertCommentSchema, type ChakraType, chakraTypes, insertVideoSchema, insertElementPostSchema, moderationDecisionSchema, videos, posts, moderationQueue, auditLog, contentTrending, viewSessions, elementCategories as elementCategoriesTable } from "@shared/schema";
import { z } from "zod";
import { db } from "./db";
import { eq, desc, sql, and, count } from "drizzle-orm";
import { users } from "@shared/models/auth";
import { getFeedByElement, getTrendingByElement, incrementViewCount, getRandomPublishedContent, invalidateFeedCache } from "./services/feed-service";
import { getUserRecommendations } from "./services/recommendations";
import { processVideoUpload, processPostCreation, resolveModeration } from "./services/moderation-workflow";
import { calculateTrendingScores } from "./services/trending-calculator";
import { applyPositivityRanking } from "./services/ranking-engine";
import { isModerator, isAdmin } from "./middleware/moderation-auth";
import { validateVideoUpload } from "./middleware/content-upload";
import type { ElementCategory } from "@shared/types";
import { elementCategoryList } from "@shared/elements";
import type { Request, Response, NextFunction } from "express";

// ── CDN / browser caching helpers ───────────────────────────
function cdnCache(maxAgeSec: number, staleWhileRevalidateSec = 60) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Cache-Control",
      `public, max-age=${maxAgeSec}, stale-while-revalidate=${staleWhileRevalidateSec}`
    );
    next();
  };
}
const FEED_CACHE = cdnCache(300, 60);       // 5 min cache, 1 min stale-while-revalidate
const TRENDING_CACHE = cdnCache(600, 120);  // 10 min cache (trending updates hourly)
const STATIC_CACHE = cdnCache(3600, 300);   // 1 hr for rarely-changing data

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  await setupAuth(app);
  registerAuthRoutes(app);
  registerObjectStorageRoutes(app);

  app.get("/api/posts", async (req, res) => {
    try {
      const chakraFilter = req.query.chakra as ChakraType | undefined;
      if (chakraFilter && !chakraTypes.includes(chakraFilter)) {
        return res.status(400).json({ message: "Invalid chakra type" });
      }
      const posts = await storage.getPosts(50, chakraFilter);
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res.status(500).json({ message: "Failed to fetch posts" });
    }
  });

  app.get("/api/posts/:id", async (req, res) => {
    try {
      const post = await storage.getPost(parseInt(req.params.id));
      if (!post) return res.status(404).json({ message: "Post not found" });
      res.json(post);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch post" });
    }
  });

  app.post("/api/posts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertPostSchema.parse({ ...req.body, authorId: userId });
      const post = await storage.createPost({ 
        authorId: parsed.authorId, 
        content: parsed.content, 
        imageUrl: parsed.imageUrl,
        elementCategory: parsed.elementCategory 
      });

      const randomChakra = chakraTypes[Math.floor(Math.random() * chakraTypes.length)];
      const randomScore = Math.round((Math.random() * 4 + 6) * 10) / 10;
      await storage.updatePostChakra(post.id, randomChakra, randomScore);

      await storage.addEnergyTransaction({
        userId,
        amount: 5,
        transactionType: "earn",
        description: "Created a new post",
      });
      await storage.updateEnergy(userId, 5);

      const updatedPost = await storage.getPost(post.id);
      res.status(201).json(updatedPost);
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(400).json({ message: "Failed to create post" });
    }
  });

  app.get("/api/posts/:id/comments", async (req, res) => {
    try {
      const comments = await storage.getComments(parseInt(req.params.id));
      res.json(comments);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.post("/api/posts/:id/comments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const postId = parseInt(req.params.id);
      const parsed = insertCommentSchema.parse({
        ...req.body,
        authorId: userId,
        postId,
      });
      const comment = await storage.createComment({ postId: parsed.postId, authorId: parsed.authorId, content: parsed.content });

      await storage.addEnergyTransaction({
        userId,
        amount: 2,
        transactionType: "earn",
        description: "Commented on a post",
      });
      await storage.updateEnergy(userId, 2);

      res.status(201).json(comment);
    } catch (error) {
      res.status(400).json({ message: "Failed to create comment" });
    }
  });

  app.post("/api/posts/:id/spark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const postId = parseInt(req.params.id);
      const sparked = await storage.toggleSpark(postId, userId);

      if (sparked) {
        await storage.addEnergyTransaction({
          userId,
          amount: 1,
          transactionType: "earn",
          description: "Sparked a post",
        });
        await storage.updateEnergy(userId, 1);
      }

      res.json({ sparked });
    } catch (error) {
      res.status(500).json({ message: "Failed to toggle spark" });
    }
  });

  app.get("/api/posts/:id/spark", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const postId = parseInt(req.params.id);
      const spark = await storage.getUserSpark(postId, userId);
      res.json({ sparked: !!spark });
    } catch (error) {
      res.status(500).json({ message: "Failed to check spark" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.get("/api/users/:id/posts", async (req, res) => {
    try {
      const posts = await storage.getUserPosts(req.params.id);
      res.json(posts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user posts" });
    }
  });

  app.patch("/api/users/me", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { displayName, bio, dominantChakra, spiritualPath, onboardingComplete } = req.body;
      const user = await storage.updateUserProfile(userId, {
        displayName,
        bio,
        dominantChakra,
        spiritualPath,
        onboardingComplete,
      });
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  app.get("/api/oracles", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const oracles = await storage.getOracles(userId);
      res.json(oracles);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch oracles" });
    }
  });

  app.post("/api/oracles/daily", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const latest = await storage.getLatestOracle(userId, "daily");
      if (latest) {
        const now = new Date();
        const lastReading = new Date(latest.createdAt);
        if (now.toDateString() === lastReading.toDateString()) {
          return res.json(latest);
        }
      }

      const user = await storage.getUser(userId);
      const chakra = chakraTypes[Math.floor(Math.random() * chakraTypes.length)];

      const readings = [
        "The cosmic energies align in your favor today. Trust in the universal flow and let your inner light guide you through any challenges.",
        "A profound transformation awaits. Your spiritual essence is shifting, bringing new awareness to areas of your life that need healing.",
        "The stars whisper of hidden connections. Pay attention to synchronicities and signs from the universe — they carry messages for your soul.",
        "Your energy field radiates with renewed strength. This is a powerful time for manifestation and setting intentions aligned with your highest good.",
        "Ancient wisdom flows through you today. Open your heart chakra and allow compassion to guide your interactions with others.",
        "The veil between worlds is thin. Trust your intuition and allow your third eye to reveal the deeper truths that surround you.",
        "A cycle of abundance begins. Your crown chakra activates, connecting you with divine consciousness and infinite possibility.",
      ];

      const content = readings[Math.floor(Math.random() * readings.length)];

      const oracle = await storage.createOracle({
        userId,
        readingType: "daily",
        content,
        chakraFocus: chakra,
        cards: null,
      });

      await storage.addEnergyTransaction({
        userId,
        amount: 10,
        transactionType: "earn",
        description: "Received daily oracle reading",
      });
      await storage.updateEnergy(userId, 10);

      res.json(oracle);
    } catch (error) {
      console.error("Error generating oracle:", error);
      res.status(500).json({ message: "Failed to generate oracle reading" });
    }
  });

  app.post("/api/oracles/tarot", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      const user = await storage.getUser(userId);
      if (user && user.energyPoints < 15) {
        return res.status(400).json({ message: "Not enough energy points for a tarot reading (requires 15)" });
      }

      const majorArcana = [
        "The Fool", "The Magician", "The High Priestess", "The Empress",
        "The Emperor", "The Hierophant", "The Lovers", "The Chariot",
        "Strength", "The Hermit", "Wheel of Fortune", "Justice",
        "The Hanged Man", "Death", "Temperance", "The Devil",
        "The Tower", "The Star", "The Moon", "The Sun", "Judgement", "The World",
      ];

      const shuffled = [...majorArcana].sort(() => Math.random() - 0.5);
      const drawn = shuffled.slice(0, 3).map((name) => ({
        name,
        reversed: Math.random() > 0.5,
        position: "",
      }));
      drawn[0].position = "Past";
      drawn[1].position = "Present";
      drawn[2].position = "Future";

      const interpretations = [
        `Your three-card spread reveals a powerful narrative. ${drawn[0].name} ${drawn[0].reversed ? "(reversed)" : ""} in the Past position suggests old patterns releasing their hold. ${drawn[1].name} ${drawn[1].reversed ? "(reversed)" : ""} in the Present brings clarity to your current spiritual journey. ${drawn[2].name} ${drawn[2].reversed ? "(reversed)" : ""} in the Future promises transformative growth ahead.`,
        `The cards speak of a journey through the depths of consciousness. ${drawn[0].name} ${drawn[0].reversed ? "(reversed)" : ""} reveals what has shaped your spiritual foundation. ${drawn[1].name} ${drawn[1].reversed ? "(reversed)" : ""} illuminates the energies surrounding you now. ${drawn[2].name} ${drawn[2].reversed ? "(reversed)" : ""} points toward the evolution of your soul's path.`,
      ];

      const chakra = chakraTypes[Math.floor(Math.random() * chakraTypes.length)];
      const content = interpretations[Math.floor(Math.random() * interpretations.length)];

      const oracle = await storage.createOracle({
        userId,
        readingType: "tarot",
        content,
        chakraFocus: chakra,
        cards: drawn,
      });

      await storage.addEnergyTransaction({
        userId,
        amount: -15,
        transactionType: "spend",
        description: "Tarot reading",
      });
      await storage.updateEnergy(userId, -15);

      res.json(oracle);
    } catch (error) {
      console.error("Error generating tarot:", error);
      res.status(500).json({ message: "Failed to generate tarot reading" });
    }
  });

  app.get("/api/energy", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const transactions = await storage.getEnergyTransactions(userId);
      const user = await storage.getUser(userId);
      res.json({
        balance: user?.energyPoints ?? 0,
        auraLevel: user?.auraLevel ?? 1,
        transactions,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch energy data" });
    }
  });

  app.post("/api/reports", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const report = await storage.createReport({
        ...req.body,
        reporterId: userId,
      });
      res.status(201).json(report);
    } catch (error) {
      res.status(400).json({ message: "Failed to create report" });
    }
  });

  // ============================================
  // ELEMENT FEED ROUTES
  // ============================================

  // GET /api/feed/element/:elementId - Paginated feed by element category
  app.get("/api/feed/element/:elementId", FEED_CACHE, async (req, res) => {
    try {
      const elementId = req.params.elementId as ElementCategory;
      if (!elementCategoryList.includes(elementId)) {
        return res.status(400).json({ message: "Invalid element category" });
      }
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      let items = await getFeedByElement(elementId, limit, offset);
      items = applyPositivityRanking(items);
      res.json(items);
    } catch (error) {
      console.error("Error fetching element feed:", error);
      res.status(500).json({ message: "Failed to fetch feed" });
    }
  });

  // GET /api/feed/element/:elementId/trending - Top 10 trending content
  app.get("/api/feed/element/:elementId/trending", TRENDING_CACHE, async (req, res) => {
    try {
      const elementId = req.params.elementId as ElementCategory;
      if (!elementCategoryList.includes(elementId)) {
        return res.status(400).json({ message: "Invalid element category" });
      }
      const limit = parseInt(req.query.limit as string) || 10;
      const items = await getTrendingByElement(elementId, limit);
      res.json(items);
    } catch (error) {
      console.error("Error fetching trending:", error);
      res.status(500).json({ message: "Failed to fetch trending" });
    }
  });

  // GET /api/feed/element/:elementId/recommended - Personalized recommendations
  app.get("/api/feed/element/:elementId/recommended", isAuthenticated, async (req: any, res) => {
    try {
      const elementId = req.params.elementId as ElementCategory;
      if (!elementCategoryList.includes(elementId)) {
        return res.status(400).json({ message: "Invalid element category" });
      }
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const items = await getUserRecommendations(userId, elementId, limit);
      res.json(items);
    } catch (error) {
      console.error("Error fetching recommendations:", error);
      res.status(500).json({ message: "Failed to fetch recommendations" });
    }
  });

  // GET /api/feed/element/:elementId/uplifting - Most positive content
  app.get("/api/feed/element/:elementId/uplifting", FEED_CACHE, async (req, res) => {
    try {
      const elementId = req.params.elementId as ElementCategory;
      if (!elementCategoryList.includes(elementId)) {
        return res.status(400).json({ message: "Invalid element category" });
      }

      const result = await db
        .select({
          id: videos.id,
          title: videos.title,
          description: videos.description,
          elementCategory: videos.elementCategory,
          videoUrl: videos.videoUrl,
          durationSeconds: videos.durationSeconds,
          viewCount: videos.viewCount,
          positivityScore: videos.positivityScore,
          createdAt: videos.createdAt,
          authorId: users.id,
          authorDisplayName: users.displayName,
          authorProfileImage: users.profileImageUrl,
        })
        .from(videos)
        .innerJoin(users, eq(videos.createdBy, users.id))
        .where(
          and(
            eq(videos.elementCategory, elementId),
            eq(videos.uploadStatus, "Published"),
            sql`${videos.positivityScore} >= 70`
          )
        )
        .orderBy(desc(videos.positivityScore))
        .limit(10);

      res.json(result.map((r) => ({
        id: r.id,
        type: "video",
        title: r.title,
        description: r.description,
        elementCategory: r.elementCategory,
        videoUrl: r.videoUrl,
        durationSeconds: r.durationSeconds,
        viewCount: r.viewCount,
        positivityScore: r.positivityScore,
        createdAt: r.createdAt.toISOString(),
        author: {
          id: r.authorId,
          displayName: r.authorDisplayName,
          profileImageUrl: r.authorProfileImage,
        },
      })));
    } catch (error) {
      console.error("Error fetching uplifting content:", error);
      res.status(500).json({ message: "Failed to fetch uplifting content" });
    }
  });

  // ============================================
  // CONTENT ROUTES
  // ============================================

  // POST /api/content/video/upload - Upload a new video
  app.post("/api/content/video/upload", isAuthenticated, validateVideoUpload, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertVideoSchema.parse(req.body);

      // Create video record in "Under Review" status
      const [video] = await db.insert(videos).values({
        title: parsed.title,
        description: parsed.description,
        elementCategory: parsed.elementCategory,
        videoUrl: parsed.videoUrl,
        durationSeconds: parsed.durationSeconds,
        createdBy: userId,
        uploadStatus: "Under Review",
        moderationStatus: "requires_review",
      }).returning();

      // Process asynchronously (analysis + safety + categorization)
      processVideoUpload(video.id, parsed.title, parsed.description, parsed.videoUrl || "", userId)
        .then(() => {
          invalidateFeedCache();
          console.log(`[Content] Video ${video.id} processing complete`);
        })
        .catch((err) => {
          console.error(`[Content] Video ${video.id} processing error:`, err);
        });

      res.status(201).json({
        id: video.id,
        status: "Under Review",
        message: "Video uploaded and queued for analysis",
      });
    } catch (error) {
      console.error("Error uploading video:", error);
      res.status(400).json({ message: "Failed to upload video" });
    }
  });

  // GET /api/content/:contentId/status - Get content status
  app.get("/api/content/:contentId/status", async (req, res) => {
    try {
      const contentId = parseInt(req.params.contentId);
      const [video] = await db.select({
        id: videos.id,
        title: videos.title,
        uploadStatus: videos.uploadStatus,
        elementCategory: videos.elementCategory,
        moderationStatus: videos.moderationStatus,
        aiAnalysisResult: videos.aiAnalysisResult,
        safetyAssessment: videos.safetyAssessment,
        positivityScore: videos.positivityScore,
      }).from(videos).where(eq(videos.id, contentId));

      if (!video) {
        return res.status(404).json({ message: "Content not found" });
      }

      res.json(video);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch content status" });
    }
  });

  // POST /api/content/:contentId/view - Track view
  app.post("/api/content/:contentId/view", async (req, res) => {
    try {
      const contentId = parseInt(req.params.contentId);
      const contentType = (req.body.contentType || "video") as "video" | "post";
      await incrementViewCount(contentId, contentType);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to track view" });
    }
  });

  // POST /api/content/:contentId/watch/start - Start watch session
  app.post("/api/content/:contentId/watch/start", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contentId = parseInt(req.params.contentId);
      const contentType = (req.body.contentType || "video") as "video" | "post";

      const [session] = await db.insert(viewSessions).values({
        userId,
        contentId,
        contentType,
      }).returning();

      res.json({ sessionId: session.id });
    } catch (error) {
      res.status(500).json({ message: "Failed to start watch session" });
    }
  });

  // POST /api/content/:contentId/watch/stop - End watch session
  app.post("/api/content/:contentId/watch/stop", isAuthenticated, async (req: any, res) => {
    try {
      const sessionId = req.body.sessionId;
      if (sessionId) {
        await db.update(viewSessions)
          .set({ endedAt: new Date() })
          .where(eq(viewSessions.id, sessionId));
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to stop watch session" });
    }
  });

  // POST /api/content/post/create - Create a new element-categorized post
  app.post("/api/content/post/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parsed = insertElementPostSchema.parse(req.body);

      const [post] = await db.insert(posts).values({
        authorId: userId,
        content: parsed.content,
        elementCategory: parsed.elementCategory,
        uploadStatus: "Under Review",
        moderationStatus: "requires_review",
      }).returning();

      // Process asynchronously
      processPostCreation(post.id, parsed.content, userId)
        .then(() => {
          invalidateFeedCache();
          console.log(`[Content] Post ${post.id} processing complete`);
        })
        .catch((err) => {
          console.error(`[Content] Post ${post.id} processing error:`, err);
        });

      res.status(201).json({
        id: post.id,
        status: "Under Review",
        message: "Post created and queued for review",
      });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(400).json({ message: "Failed to create post" });
    }
  });

  // POST /api/content/:postId/engage - Track post engagement
  app.post("/api/content/:postId/engage", isAuthenticated, async (req: any, res) => {
    try {
      const postId = parseInt(req.params.postId);
      await db.update(posts)
        .set({ engagementScore: sql`COALESCE(${posts.engagementScore}, 0) + 1` })
        .where(eq(posts.id, postId));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to track engagement" });
    }
  });

  // ============================================
  // ORACLE ROUTES
  // ============================================

  // GET /api/oracle/random - Get random published content
  app.get("/api/oracle/random", async (req, res) => {
    try {
      const item = await getRandomPublishedContent();
      if (!item) {
        return res.status(404).json({ message: "No published content available" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error fetching random content:", error);
      res.status(500).json({ message: "Failed to fetch random content" });
    }
  });

  // ============================================
  // MODERATION ROUTES
  // ============================================

  // GET /api/moderation/queue - Get moderation queue
  app.get("/api/moderation/queue", isAuthenticated, isModerator, async (req: any, res) => {
    try {
      const statusFilter = req.query.status || "pending";
      const result = await db
        .select()
        .from(moderationQueue)
        .where(eq(moderationQueue.status, statusFilter as any))
        .orderBy(
          sql`CASE ${moderationQueue.priority} 
            WHEN 'urgent' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            WHEN 'low' THEN 4 
          END`,
          desc(moderationQueue.createdAt)
        );

      res.json(result);
    } catch (error) {
      console.error("Error fetching moderation queue:", error);
      res.status(500).json({ message: "Failed to fetch moderation queue" });
    }
  });

  // POST /api/moderation/:contentId/decide - Make moderation decision
  app.post("/api/moderation/:contentId/decide", isAuthenticated, isModerator, async (req: any, res) => {
    try {
      const contentId = parseInt(req.params.contentId);
      const moderatorId = req.user.claims.sub;
      const parsed = moderationDecisionSchema.parse(req.body);
      const contentType = (req.body.contentType || "video") as "video" | "post";

      await resolveModeration(contentId, contentType, parsed.decision, parsed.notes, moderatorId);
      invalidateFeedCache();

      res.json({ success: true, message: `Content ${parsed.decision}` });
    } catch (error) {
      console.error("Error processing moderation decision:", error);
      res.status(400).json({ message: "Failed to process moderation decision" });
    }
  });

  // ============================================
  // ADMIN / ANALYTICS ROUTES
  // ============================================

  // GET /api/analytics/overview - Get platform analytics
  app.get("/api/analytics/overview", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const [videoCount] = await db.select({ count: count() }).from(videos);
      const [postCount] = await db.select({ count: count() }).from(posts);
      const [approvedCount] = await db.select({ count: count() }).from(videos).where(eq(videos.moderationStatus, "auto_approved"));
      const [flaggedCount] = await db.select({ count: count() }).from(videos).where(eq(videos.moderationStatus, "requires_review"));

      const totalVideos = videoCount.count;
      const totalPosts = postCount.count;
      const approvalRate = totalVideos > 0 ? (Number(approvedCount.count) / Number(totalVideos)) * 100 : 0;
      const safetyFlagRate = totalVideos > 0 ? (Number(flaggedCount.count) / Number(totalVideos)) * 100 : 0;

      // Element distribution
      const distribution = await db
        .select({
          element: videos.elementCategory,
          count: count(),
        })
        .from(videos)
        .groupBy(videos.elementCategory);

      const elementDistribution: Record<string, number> = {};
      for (const d of distribution) {
        elementDistribution[d.element] = Number(d.count);
      }

      res.json({
        totalVideos: Number(totalVideos),
        totalPosts: Number(totalPosts),
        approvalRate: Math.round(approvalRate * 10) / 10,
        safetyFlagRate: Math.round(safetyFlagRate * 10) / 10,
        elementDistribution,
        trendingTopics: [],
      });
    } catch (error) {
      console.error("Error fetching analytics:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // GET /api/admin/content - List all content with filtering
  app.get("/api/admin/content", isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const elementFilter = req.query.element as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      let query = db
        .select({
          id: videos.id,
          title: videos.title,
          description: videos.description,
          elementCategory: videos.elementCategory,
          uploadStatus: videos.uploadStatus,
          moderationStatus: videos.moderationStatus,
          viewCount: videos.viewCount,
          positivityScore: videos.positivityScore,
          createdAt: videos.createdAt,
          authorId: users.id,
          authorDisplayName: users.displayName,
        })
        .from(videos)
        .innerJoin(users, eq(videos.createdBy, users.id))
        .orderBy(desc(videos.createdAt))
        .limit(limit)
        .offset(offset);

      const result = await query;
      res.json(result);
    } catch (error) {
      console.error("Error fetching admin content:", error);
      res.status(500).json({ message: "Failed to fetch content" });
    }
  });

  // GET /api/social/friends/watching - Friends currently watching
  app.get("/api/social/friends/watching", isAuthenticated, async (req: any, res) => {
    try {
      // Get active viewing sessions (started but not ended)
      const activeSessions = await db
        .select({
          userId: viewSessions.userId,
          contentId: viewSessions.contentId,
          contentType: viewSessions.contentType,
          startedAt: viewSessions.startedAt,
          userName: users.displayName,
          userImage: users.profileImageUrl,
        })
        .from(viewSessions)
        .innerJoin(users, eq(viewSessions.userId, users.id))
        .where(sql`${viewSessions.endedAt} IS NULL AND ${viewSessions.startedAt} > NOW() - INTERVAL '30 minutes'`)
        .limit(20);

      res.json(activeSessions);
    } catch (error) {
      console.error("Error fetching friends watching:", error);
      res.status(500).json({ message: "Failed to fetch friends watching" });
    }
  });

  // ============================================
  // MONITORING: Health & Error Metrics Endpoint
  // ============================================
  app.get("/api/health", async (_req, res) => {
    try {
      // Quick DB ping
      await db.execute(sql`SELECT 1`);
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
      });
    } catch {
      res.status(503).json({ status: "unhealthy", error: "Database unreachable" });
    }
  });

  app.get("/api/monitoring/errors", isAuthenticated, isAdmin, async (_req: any, res) => {
    try {
      const { getErrorMetrics } = await import("./lib/logging");
      const metrics = getErrorMetrics();
      res.json({
        ...metrics,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch error metrics" });
    }
  });

  // ============================================
  // SCHEDULED: Trending recalculation (every 60 minutes)
  // ============================================
  setInterval(() => {
    calculateTrendingScores()
      .then(() => console.log("[Scheduled] Trending scores recalculated"))
      .catch((err) => console.error("[Scheduled] Trending recalculation error:", err));
  }, 60 * 60 * 1000); // Every hour

  // Initial trending calculation on startup
  setTimeout(() => {
    calculateTrendingScores().catch((err) =>
      console.error("[Startup] Initial trending calculation error:", err)
    );
  }, 5000);

  return httpServer;
}
