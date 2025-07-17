"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Plus, Calendar, User, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { toast } from "sonner";
import Link from "next/link";

interface Class {
  id: string;
  name: string;
  teacher_id: string;
  created_at: string;
}

interface Post {
  id: string;
  content: string;
  created_at: string;
  teacher_id: string;
  class_id: string;
  file_url?: string;
  file_name?: string;
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
  reactions?: {
    thumbs_up: number;
    heart: number;
    clap: number;
    smile: number;
  };
}

export default function ClassPostsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classData, setClassData] = useState<Class | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [showReactorsDialog, setShowReactorsDialog] = useState(false);
  const [reactors, setReactors] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [reactorsLoading, setReactorsLoading] = useState(false);
  const [selectedReaction, setSelectedReaction] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  useEffect(() => {
    if (user && classId) {
      fetchClassData();
      fetchPosts();
    }
  }, [user, classId]);

  const fetchClassData = async () => {
    if (!user || !classId) return;
    try {
      const { data: classData, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .eq("teacher_id", user.id)
        .single();
      if (classError) {
        console.error("Error fetching class:", classError);
        toast.error("Error fetching class details");
        router.push("/teacher/classes");
        return;
      }
      if (!classData) {
        toast.error("Class not found");
        router.push("/teacher/classes");
        return;
      }
      setClassData(classData);
    } catch (error) {
      console.error("Error fetching class data:", error);
      toast.error("Error fetching class data");
    }
  };

  const fetchPosts = async () => {
    if (!user || !classId) return;
    try {
      setLoading(true);
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          id,
          content,
          created_at,
          teacher_id,
          class_id,
          file_url,
          file_name,
          teachers (
            id,
            name,
            email
          )
        `)
        .eq("class_id", classId)
        .order("created_at", { ascending: false });
      if (postsError) {
        console.error("Error fetching posts:", postsError);
        toast.error("Error fetching posts");
        setPosts([]);
        return;
      }
      if (postsData) {
        // For each post, fetch reactions
        const postsWithReactions = await Promise.all(postsData.map(async (post: any) => {
          const { data: reactionCounts, error: reactionCountsError } = await supabase
            .from('post_reactions')
            .select('reaction_type')
            .eq('post_id', post.id);
          const reactions = { thumbs_up: 0, heart: 0, clap: 0, smile: 0 };
          if (!reactionCountsError && reactionCounts) {
            reactionCounts.forEach((reaction: any) => {
              if (reactions.hasOwnProperty(reaction.reaction_type)) {
                reactions[reaction.reaction_type as keyof typeof reactions]++;
              }
            });
          }
          return {
            ...post,
            teacher: post.teachers,
            reactions,
          };
        }));
        setPosts(postsWithReactions);
      } else {
        setPosts([]);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      toast.error("Error fetching posts");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePost = async (postData: { content: string, file_url?: string, file_name?: string }) => {
    if (!user || !classId) return;
    try {
      const { data: createdPost, error: postError } = await supabase
        .from("posts")
        .insert([
          {
            content: postData.content,
            teacher_id: user.id,
            class_id: classId,
            file_url: postData.file_url || null,
            file_name: postData.file_name || null,
          },
        ])
        .select();
      if (postError) {
        console.error("Error creating post:", postError);
        toast.error("Error creating post: " + postError.message);
        return;
      }
      if (!createdPost || createdPost.length === 0) {
        toast.error("Error creating post: No post data returned");
        return;
      }
      setIsCreatePostOpen(false);
      await fetchPosts();
      toast.success("Class announcement created successfully!");
    } catch (error) {
      console.error("Error creating post:", error);
      toast.error("Error creating post");
    }
  };

  // Fetch reactors for a post and reaction type
  const fetchReactors = async (postId: string, reactionType: string) => {
    setReactorsLoading(true);
    setReactors([]);
    setSelectedReaction(reactionType);
    setShowReactorsDialog(true);
    setSelectedPost(posts.find(p => p.id === postId) || null);
    try {
      const { data, error } = await supabase
        .from('post_reactions')
        .select('parent_id, parents(name, email)')
        .eq('post_id', postId)
        .eq('reaction_type', reactionType);
      if (error) {
        toast.error('Error fetching reactors');
        setReactors([]);
      } else {
        setReactors(((data as any[]) || []).map((r: any) => ({
          id: r.parent_id,
          name: Array.isArray(r.parents) ? ((r.parents as any[])[0]?.name || 'Unknown') : (r.parents?.name || 'Unknown'),
          email: Array.isArray(r.parents) ? ((r.parents as any[])[0]?.email || '') : (r.parents?.email || '')
        })));
      }
    } catch (e) {
      toast.error('Error fetching reactors');
      setReactors([]);
    } finally {
      setReactorsLoading(false);
    }
  };

  // Helper for icons
  const getReactionIcon = (type: string) => {
    switch (type) {
      case 'thumbs_up':
        return <span title="Thumbs Up" role="img">👍</span>;
      case 'heart':
        return <span title="Heart" role="img">❤️</span>;
      case 'clap':
        return <span title="Clap" role="img">👏</span>;
      case 'smile':
        return <span title="Smile" role="img">😊</span>;
      default:
        return <span>👍</span>;
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading class posts...</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (!classData) {
    return (
      <Layout>
        <div className="p-8">
          <div className="text-center py-8">
            <p className="text-gray-600">Class not found</p>
            <Link href="/teacher/classes" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
              ← Back to Classes
            </Link>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Link href="/teacher/classes" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Class Announcements</h1>
              <p className="text-gray-600">{classData.name}</p>
            </div>
          </div>
          <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Announcement
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Class Announcement</DialogTitle>
                <DialogDescription>
                  Share important information with all parents in this class.
                </DialogDescription>
              </DialogHeader>
              <CreatePostForm onSubmit={handleCreatePost} />
            </DialogContent>
          </Dialog>
        </div>
        {/* Posts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MessageSquare className="w-5 h-5" />
              <span>Class Announcements ({posts.length})</span>
            </CardTitle>
            <CardDescription>
              Announcements visible to all parents with children in this class
            </CardDescription>
          </CardHeader>
          <CardContent>
            {posts.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Announcements Yet</h3>
                <p className="text-gray-600 mb-4">
                  Start sharing important updates with all parents in {classData.name}.
                </p>
                <Button onClick={() => setIsCreatePostOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Announcement
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <div key={post.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900">
                          {post.teacher?.name || "Unknown Teacher"}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-500">
                          {new Date(post.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
                    {post.file_url && (
                      post.file_url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i) ? (
                        <div className="mt-3"><img src={post.file_url} alt="Announcement attachment" className="max-w-full h-auto rounded-lg border" style={{ maxHeight: 400 }} /></div>
                      ) : (
                        <div className="mt-3"><a href={post.file_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{post.file_name || 'Download attachment'}</a></div>
                      )
                    )}
                    {post.reactions && (
                      <div className="flex items-center space-x-4 text-sm text-gray-500 mt-3">
                        {post.reactions.thumbs_up > 0 && (
                          <button
                            type="button"
                            className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                            onClick={() => fetchReactors(post.id, 'thumbs_up')}
                            title="See who reacted"
                          >
                            {getReactionIcon('thumbs_up')}
                            <span>{post.reactions.thumbs_up}</span>
                          </button>
                        )}
                        {post.reactions.heart > 0 && (
                          <button
                            type="button"
                            className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                            onClick={() => fetchReactors(post.id, 'heart')}
                            title="See who reacted"
                          >
                            {getReactionIcon('heart')}
                            <span>{post.reactions.heart}</span>
                          </button>
                        )}
                        {post.reactions.clap > 0 && (
                          <button
                            type="button"
                            className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                            onClick={() => fetchReactors(post.id, 'clap')}
                            title="See who reacted"
                          >
                            {getReactionIcon('clap')}
                            <span>{post.reactions.clap}</span>
                          </button>
                        )}
                        {post.reactions.smile > 0 && (
                          <button
                            type="button"
                            className="flex items-center space-x-1 focus:outline-none bg-transparent border-0 p-0 m-0 cursor-pointer"
                            onClick={() => fetchReactors(post.id, 'smile')}
                            title="See who reacted"
                          >
                            {getReactionIcon('smile')}
                            <span>{post.reactions.smile}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <Dialog open={showReactorsDialog} onOpenChange={setShowReactorsDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedReaction && selectedPost ? (
                <span>
                  Reactors for <span className="font-semibold">{selectedReaction.replace('_', ' ')}</span> on announcement:<br />
                  <span className="text-xs text-gray-500">{selectedPost.content.slice(0, 60)}{selectedPost.content.length > 60 ? '...' : ''}</span>
                </span>
              ) : 'Reactors'}
            </DialogTitle>
          </DialogHeader>
          {reactorsLoading ? (
            <div className="py-4 text-center">Loading...</div>
          ) : reactors.length === 0 ? (
            <div className="py-4 text-center text-gray-500">No parents have reacted with this emoji yet.</div>
          ) : (
            <ul className="space-y-2 py-2">
              {reactors.map((parent) => (
                <li key={parent.id} className="flex items-center space-x-3">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="font-medium">{parent.name}</span>
                  {parent.email && <span className="text-gray-500 text-xs">({parent.email})</span>}
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

// Create Post Form Component
function CreatePostForm({ onSubmit }: { onSubmit: (data: { content: string, file_url?: string, file_name?: string }) => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 2 * 1024 * 1024) {
        toast.error("File size must be less than 2MB");
        return;
      }
      setFile(selected);
      if (selected.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreview(ev.target?.result as string);
        reader.readAsDataURL(selected);
      } else {
        setFilePreview(null);
      }
    }
  };

  // Handle paste image
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
      const pastedFile = e.clipboardData.files[0];
      if (pastedFile.type.startsWith("image/")) {
        if (pastedFile.size > 2 * 1024 * 1024) {
          toast.error("Image size must be less than 2MB");
          return;
        }
        setFile(pastedFile);
        const reader = new FileReader();
        reader.onload = (ev) => setFilePreview(ev.target?.result as string);
        reader.readAsDataURL(pastedFile);
        e.preventDefault();
      }
    }
  };

  // Upload file to Supabase Storage
  const uploadFile = async (file: File): Promise<{ url: string, name: string } | null> => {
    try {
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const filePath = fileName;
      const { error } = await supabase.storage.from('class-announcements').upload(filePath, file);
      if (error) {
        toast.error('Error uploading file: ' + (error.message || JSON.stringify(error)));
        return null;
      }
      const { data } = supabase.storage.from('class-announcements').getPublicUrl(filePath);
      return { url: data.publicUrl, name: file.name };
    } catch (err: any) {
      toast.error('Error uploading file: ' + (err.message || JSON.stringify(err)));
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Please enter announcement content");
      return;
    }
    setLoading(true);
    let file_url, file_name;
    if (file) {
      const uploaded = await uploadFile(file);
      if (!uploaded) {
        setLoading(false);
        return;
      }
      file_url = uploaded.url;
      file_name = uploaded.name;
    }
    await onSubmit({ content, file_url, file_name });
    setContent("");
    setFile(null);
    setFilePreview(null);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="content">Announcement Content</Label>
        <textarea
          id="content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onPaste={handlePaste}
          placeholder="Share important information with all parents in this class..."
          rows={6}
          required
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">Attach File or Image (max 2MB)</Label>
        <input
          id="file"
          type="file"
          accept="*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {file && (
          <div className="mt-2">
            {filePreview ? (
              <img src={filePreview} alt="Preview" className="max-h-40 rounded border" />
            ) : (
              <span className="text-sm text-gray-700">{file.name}</span>
            )}
            <Button type="button" variant="ghost" size="sm" className="ml-2" onClick={() => { setFile(null); setFilePreview(null); }}>Remove</Button>
          </div>
        )}
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Announcement"}
        </Button>
      </div>
    </form>
  );
} 