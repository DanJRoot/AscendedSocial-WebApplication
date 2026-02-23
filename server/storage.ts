import {
  users,
  posts,
  comments,
  sparks,
  oracles,
  energyTransactions,
  reports,
  type User,
  type Post,
  type Comment,
  type Spark,
  type Oracle,
  type EnergyTransaction,
  type Report,
  type ChakraType,
} from "@shared/schema";
import type { ElementCategory } from "@shared/types";
import { db } from "./db";
import { eq, desc, sql, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  updateUserProfile(id: string, data: Partial<User>): Promise<User>;
  getPosts(limit?: number, chakraFilter?: ChakraType): Promise<(Post & { author: User })[]>;
  getPost(id: number): Promise<(Post & { author: User }) | undefined>;
  getUserPosts(userId: string): Promise<Post[]>;
  createPost(data: { authorId: string; content: string; imageUrl?: string }): Promise<Post>;
  updatePostChakra(id: number, chakraType: ChakraType, frequencyScore: number): Promise<void>;
  getComments(postId: number): Promise<(Comment & { author: User })[]>;
  createComment(data: { postId: number; authorId: string; content: string }): Promise<Comment>;
  toggleSpark(postId: number, userId: string): Promise<boolean>;
  getUserSpark(postId: number, userId: string): Promise<Spark | undefined>;
  getOracles(userId: string): Promise<Oracle[]>;
  createOracle(data: { userId: string; readingType: string; content: string; cards?: unknown; chakraFocus?: ChakraType | null }): Promise<Oracle>;
  getLatestOracle(userId: string, readingType: string): Promise<Oracle | undefined>;
  getEnergyTransactions(userId: string): Promise<EnergyTransaction[]>;
  addEnergyTransaction(data: { userId: string; amount: number; transactionType: string; description?: string }): Promise<EnergyTransaction>;
  updateEnergy(userId: string, amount: number): Promise<void>;
  createReport(data: { reporterId: string; postId?: number; reason: string }): Promise<Report>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async updateUserProfile(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getPosts(limit = 50, chakraFilter?: ChakraType): Promise<(Post & { author: User })[]> {
    const conditions = chakraFilter ? eq(posts.chakraType, chakraFilter) : undefined;
    const result = await db
      .select()
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(conditions)
      .orderBy(desc(posts.createdAt))
      .limit(limit);

    return result.map((r) => ({
      ...r.posts,
      author: r.users,
    }));
  }

  async getPost(id: number): Promise<(Post & { author: User }) | undefined> {
    const [result] = await db
      .select()
      .from(posts)
      .innerJoin(users, eq(posts.authorId, users.id))
      .where(eq(posts.id, id));

    if (!result) return undefined;
    return { ...result.posts, author: result.users };
  }

  async getUserPosts(userId: string): Promise<Post[]> {
    return await db
      .select()
      .from(posts)
      .where(eq(posts.authorId, userId))
      .orderBy(desc(posts.createdAt));
  }

  async createPost(data: { authorId: string; content: string; imageUrl?: string; elementCategory?: ElementCategory }): Promise<Post> {
    const [newPost] = await db.insert(posts).values({
      authorId: data.authorId,
      content: data.content,
      imageUrl: data.imageUrl,
      elementCategory: data.elementCategory,
    }).returning();
    return newPost;
  }

  async updatePostChakra(id: number, chakraType: ChakraType, frequencyScore: number): Promise<void> {
    await db
      .update(posts)
      .set({ chakraType, frequencyScore })
      .where(eq(posts.id, id));
  }

  async getComments(postId: number): Promise<(Comment & { author: User })[]> {
    const result = await db
      .select()
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));

    return result.map((r) => ({
      ...r.comments,
      author: r.users,
    }));
  }

  async createComment(data: { postId: number; authorId: string; content: string }): Promise<Comment> {
    const [newComment] = await db.insert(comments).values({
      postId: data.postId,
      authorId: data.authorId,
      content: data.content,
    }).returning();
    await db
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, data.postId));
    return newComment;
  }

  async toggleSpark(postId: number, userId: string): Promise<boolean> {
    const existing = await this.getUserSpark(postId, userId);
    if (existing) {
      await db.delete(sparks).where(eq(sparks.id, existing.id));
      await db
        .update(posts)
        .set({ sparkCount: sql`${posts.sparkCount} - 1` })
        .where(eq(posts.id, postId));
      return false;
    } else {
      await db.insert(sparks).values({ postId, userId });
      await db
        .update(posts)
        .set({ sparkCount: sql`${posts.sparkCount} + 1` })
        .where(eq(posts.id, postId));
      return true;
    }
  }

  async getUserSpark(postId: number, userId: string): Promise<Spark | undefined> {
    const [spark] = await db
      .select()
      .from(sparks)
      .where(and(eq(sparks.postId, postId), eq(sparks.userId, userId)));
    return spark;
  }

  async getOracles(userId: string): Promise<Oracle[]> {
    return await db
      .select()
      .from(oracles)
      .where(eq(oracles.userId, userId))
      .orderBy(desc(oracles.createdAt));
  }

  async createOracle(data: { userId: string; readingType: string; content: string; cards?: unknown; chakraFocus?: ChakraType | null }): Promise<Oracle> {
    const [newOracle] = await db.insert(oracles).values({
      userId: data.userId,
      readingType: data.readingType,
      content: data.content,
      cards: data.cards ?? null,
      chakraFocus: data.chakraFocus ?? null,
    }).returning();
    return newOracle;
  }

  async getLatestOracle(userId: string, readingType: string): Promise<Oracle | undefined> {
    const [oracle] = await db
      .select()
      .from(oracles)
      .where(and(eq(oracles.userId, userId), eq(oracles.readingType, readingType)))
      .orderBy(desc(oracles.createdAt))
      .limit(1);
    return oracle;
  }

  async getEnergyTransactions(userId: string): Promise<EnergyTransaction[]> {
    return await db
      .select()
      .from(energyTransactions)
      .where(eq(energyTransactions.userId, userId))
      .orderBy(desc(energyTransactions.createdAt));
  }

  async addEnergyTransaction(data: { userId: string; amount: number; transactionType: string; description?: string }): Promise<EnergyTransaction> {
    const [t] = await db.insert(energyTransactions).values({
      userId: data.userId,
      amount: data.amount,
      transactionType: data.transactionType,
      description: data.description,
    }).returning();
    return t;
  }

  async updateEnergy(userId: string, amount: number): Promise<void> {
    await db
      .update(users)
      .set({ energyPoints: sql`${users.energyPoints} + ${amount}` })
      .where(eq(users.id, userId));
  }

  async createReport(data: { reporterId: string; postId?: number; reason: string }): Promise<Report> {
    const [newReport] = await db.insert(reports).values({
      reporterId: data.reporterId,
      postId: data.postId,
      reason: data.reason,
    }).returning();
    return newReport;
  }
}

export const storage = new DatabaseStorage();
