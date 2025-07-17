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
  teacher?: {
    id: string;
    name: string;
    email: string;
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
        const postsWithTeachers = postsData.map((post: any) => ({
          ...post,
          teacher: post.teachers,
        }));
        setPosts(postsWithTeachers);
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

  const handleCreatePost = async (postData: { content: string }) => {
    if (!user || !classId) return;
    try {
      const { data: createdPost, error: postError } = await supabase
        .from("posts")
        .insert([
          {
            content: postData.content,
            teacher_id: user.id,
            class_id: classId,
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
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// Create Post Form Component
function CreatePostForm({ onSubmit }: { onSubmit: (data: { content: string }) => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      toast.error("Please enter announcement content");
      return;
    }
    setLoading(true);
    await onSubmit({ content });
    setContent("");
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
          placeholder="Share important information with all parents in this class..."
          rows={6}
          required
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create Announcement"}
        </Button>
      </div>
    </form>
  );
} 