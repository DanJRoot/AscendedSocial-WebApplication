import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, ArrowLeft, Send } from "lucide-react";
import ImageLightbox from "@/components/ImageLightbox";
import type { Post, User, Comment, ChakraType } from "@shared/schema";
import { chakraColors, chakraLabels } from "@shared/schema";

type PostWithAuthor = Post & { author: User };
type CommentWithAuthor = Comment & { author: User };

export default function PostDetail() {
  const [, params] = useRoute("/post/:id");
  const postId = parseInt(params?.id ?? "0");
  const { user } = useAuth();
  const { toast } = useToast();
  const [commentText, setCommentText] = useState("");

  const postQuery = useQuery<PostWithAuthor>({
    queryKey: ["/api/posts", postId],
  });

  const commentsQuery = useQuery<CommentWithAuthor[]>({
    queryKey: ["/api/posts", postId, "comments"],
  });

  const commentMutation = useMutation({
    mutationFn: (data: { content: string }) =>
      apiRequest("POST", `/api/posts/${postId}/comments`, data),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/posts", postId, "comments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/posts"] });
      toast({ title: "Comment added" });
    },
  });

  const timeAgo = (date: string | Date) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  const post = postQuery.data;

  return (
    <div className="min-h-screen bg-background/50">
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-muted/80 transition-colors shadow-sm border border-border/50 bg-card" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">Echo</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {postQuery.isLoading ? (
          <div className="space-y-6 p-6 bg-card rounded-3xl border border-border/50 shadow-sm">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-32 rounded-full" />
                <Skeleton className="h-3 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        ) : post ? (
          <div className="space-y-8">
            <div className="p-6 sm:p-8 bg-card rounded-3xl border border-border/50 shadow-sm relative overflow-hidden">
              {post.chakraType && (
                <div 
                  className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] opacity-10 pointer-events-none -translate-y-1/2 translate-x-1/4"
                  style={{ backgroundColor: chakraColors[post.chakraType as ChakraType] }}
                />
              )}
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <Link href={`/profile/${post.authorId}`}>
                  <Avatar className="h-12 w-12 cursor-pointer ring-2 ring-background shadow-sm">
                    <AvatarImage src={post.author.profileImageUrl ?? undefined} />
                    <AvatarFallback className="text-sm font-medium bg-primary/10 text-primary">
                      {(post.author.firstName?.[0] ?? "?").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1">
                  <Link href={`/profile/${post.authorId}`}>
                    <span className="text-base font-semibold cursor-pointer hover:text-primary transition-colors" data-testid="text-post-author">
                      {post.author.displayName || post.author.firstName || "Seeker"}
                    </span>
                  </Link>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-muted/50">{timeAgo(post.createdAt)}</span>
                    {post.chakraType && (
                      <>
                        <span className="text-border/50">·</span>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span
                            className="w-2 h-2 rounded-full shadow-sm"
                            style={{ backgroundColor: chakraColors[post.chakraType as ChakraType], boxShadow: `0 0 8px ${chakraColors[post.chakraType as ChakraType]}60` }}
                          />
                          {chakraLabels[post.chakraType as ChakraType]}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-lg leading-relaxed text-foreground/90 whitespace-pre-wrap" data-testid="text-post-content">{post.content}</p>

              {post.imageUrl && (
                <ImageLightbox src={post.imageUrl} alt="Post image">
                  <div className="mt-6 rounded-2xl overflow-hidden border border-border/50 shadow-sm">
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full max-h-[500px] object-cover hover:scale-[1.02] transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                </ImageLightbox>
              )}

              <div className="flex items-center gap-6 mt-6 pt-6 border-t border-border/50 text-sm font-medium text-muted-foreground">
                <span className="flex items-center gap-2 text-primary drop-shadow-[0_0_8px_rgba(var(--primary),0.5)]">
                  <Sparkles className="h-4 w-4 fill-primary" />
                  {post.sparkCount} sparks
                </span>
                <span className="flex items-center gap-2">
                  {post.commentCount} comments
                </span>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8 bg-card rounded-3xl border border-border/50 shadow-sm">
              <h3 className="text-xl font-serif font-bold tracking-tight mb-6">Echoes</h3>
              <div className="flex gap-4 items-start">
                <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm hidden sm:block">
                  <AvatarImage src={user?.profileImageUrl ?? undefined} />
                  <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                    {(user?.firstName?.[0] ?? "?").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 relative">
                  <Textarea
                    placeholder="Add your echo..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="resize-none min-h-[60px] text-base rounded-2xl border-border/50 focus-visible:ring-primary/30 pr-14 bg-muted/20"
                    data-testid="input-comment"
                  />
                  <Button
                    size="icon"
                    onClick={() => commentMutation.mutate({ content: commentText })}
                    disabled={!commentText.trim() || commentMutation.isPending}
                    className="absolute bottom-2 right-2 h-8 w-8 rounded-full shadow-sm hover:shadow-md transition-all duration-300"
                    data-testid="button-add-comment"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-8 space-y-6">
                {commentsQuery.isLoading ? (
                  <div className="space-y-6">
                    {[1, 2].map((i) => (
                      <div key={i} className="flex gap-4">
                        <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                        <div className="space-y-2 flex-1">
                          <Skeleton className="h-4 w-32 rounded-full" />
                          <Skeleton className="h-16 w-full rounded-2xl" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : commentsQuery.data?.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-base font-medium text-muted-foreground">
                      No echoes yet. Be the first to respond.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {commentsQuery.data?.map((comment) => (
                      <div key={comment.id} className="flex gap-4 group">
                        <Avatar className="h-10 w-10 shrink-0 ring-2 ring-background shadow-sm">
                          <AvatarImage src={comment.author.profileImageUrl ?? undefined} />
                          <AvatarFallback className="text-xs font-medium bg-primary/10 text-primary">
                            {(comment.author.firstName?.[0] ?? "?").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 bg-muted/20 p-4 rounded-2xl rounded-tl-none border border-border/50 group-hover:border-primary/20 transition-colors">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-foreground">
                              {comment.author.displayName || comment.author.firstName || "Seeker"}
                            </span>
                            <span className="text-xs font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-background/50">
                              {timeAgo(comment.createdAt)}
                            </span>
                          </div>
                          <p className="text-[15px] leading-relaxed text-foreground/80 whitespace-pre-wrap">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">Post not found.</p>
        )}
      </main>
    </div>
  );
}
