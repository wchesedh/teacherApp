"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MessageSquare, Plus, Calendar, User, ArrowLeft, Edit, Trash2, MoreHorizontal } from "lucide-react";
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
  file_urls?: string[];
  file_names?: string[];
  teacher?: {
    id: string;
    name: string;
    email: string;
  };
  class?: {
    id: string;
    name: string;
    academic_period?: {
      id: string;
      name: string;
      type: string;
      school_year: string;
    };
  };
  reactions?: {
    thumbs_up: number;
    heart: number;
    clap: number;
    smile: number;
  };
}

// Helper function to format date and time
const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
  
  // Format the date
  const options: Intl.DateTimeFormatOptions = { 
    month: 'long', 
    day: 'numeric',
    year: 'numeric'
  };
  const dateStr = date.toLocaleDateString('en-US', options);
  
  // Format the time in 12-hour format
  const timeStr = date.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  // If it's today, show "Today at time (actual date)"
  if (diffInHours < 24 && date.toDateString() === now.toDateString()) {
    return `Today at ${timeStr} (${dateStr})`;
  }
  
  // If it's yesterday, show "Yesterday at time (actual date)"
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${timeStr} (${dateStr})`;
  }
  
  // Otherwise show full date and time
  return `${dateStr} at ${timeStr}`;
};

export default function ClassPostsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const classId = params.id as string;

  const [classData, setClassData] = useState<Class | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [isEditPostOpen, setIsEditPostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
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
          file_urls,
          file_names,
          teachers (
            id,
            name,
            email
          ),
          classes (
            id,
            name,
            academic_period_id,
            academic_periods (
              id,
              name,
              type,
              school_year
            )
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
            class: post.classes ? {
              id: post.classes.id,
              name: post.classes.name,
              academic_period: post.classes.academic_periods
            } : undefined,
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

  const handleCreatePost = async (postData: { content: string, file_urls?: string[], file_names?: string[] }) => {
    if (!user || !classId) return;
    try {
      const { data: createdPost, error: postError } = await supabase
        .from("posts")
        .insert([
          {
            content: postData.content,
            teacher_id: user.id,
            class_id: classId,
            file_urls: postData.file_urls || null,
            file_names: postData.file_names || null,
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

  const handleEditPost = async (postData: { content: string, file_urls?: string[], file_names?: string[] }) => {
    if (!user || !editingPost) return;
    try {
      const { error: postError } = await supabase
        .from("posts")
        .update({
          content: postData.content,
          file_urls: postData.file_urls || null,
          file_names: postData.file_names || null,
        })
        .eq("id", editingPost.id)
        .eq("teacher_id", user.id); // Ensure only the author can edit

      if (postError) {
        console.error("Error updating post:", postError);
        toast.error("Error updating post: " + postError.message);
        return;
      }

      setIsEditPostOpen(false);
      setEditingPost(null);
      await fetchPosts();
      toast.success("Announcement updated successfully!");
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Error updating post");
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    
    if (!confirm("Are you sure you want to delete this announcement? This action cannot be undone.")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("teacher_id", user.id); // Ensure only the author can delete

      if (error) {
        console.error("Error deleting post:", error);
        toast.error("Error deleting post: " + error.message);
        return;
      }

      await fetchPosts();
      toast.success("Announcement deleted successfully!");
    } catch (error) {
      console.error("Error deleting post:", error);
      toast.error("Error deleting post");
    }
  };

  const openEditDialog = (post: Post) => {
    setEditingPost(post);
    setIsEditPostOpen(true);
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
        setReactors((data || []).map((r: any) => {
          const parent = Array.isArray(r.parents) ? r.parents[0] : r.parents;
          return {
            id: r.parent_id,
            name: parent?.name || 'Unknown',
            email: parent?.email || ''
          };
        }));
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

          {/* Edit Post Dialog */}
          <Dialog open={isEditPostOpen} onOpenChange={setIsEditPostOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Class Announcement</DialogTitle>
                <DialogDescription>
                  Update the announcement content and attachments.
                </DialogDescription>
              </DialogHeader>
              {editingPost && (
                <EditPostForm 
                  post={editingPost} 
                  onSubmit={handleEditPost} 
                  onCancel={() => {
                    setIsEditPostOpen(false);
                    setEditingPost(null);
                  }}
                />
              )}
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
                        {post.class?.academic_period && (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 border border-green-200">
                            📅 {post.class.academic_period.name}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Calendar className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-500">
                            {formatDateTime(post.created_at)}
                          </span>
                        </div>
                        {post.teacher_id === user?.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                              >
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(post)}>
                                <Edit className="w-3 h-3 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeletePost(post.id)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-3 h-3 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-600 whitespace-pre-wrap">{post.content}</p>
                    {post.file_urls && post.file_urls.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {post.file_urls.map((url, index) => (
                          <div key={index} className="relative">
                            <img 
                              src={url} 
                              alt={`Announcement image ${index + 1}`} 
                              className="w-full h-48 object-cover rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(url, '_blank')}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Fallback for old single file format */}
                    {post.file_url && !post.file_urls && (
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
function CreatePostForm({ onSubmit }: { onSubmit: (data: { content: string, file_urls?: string[], file_names?: string[] }) => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 2MB. Please choose a smaller file.`);
        return false;
      }
      return true;
    });

    if (files.length + validFiles.length > 5) {
      toast.error("You can only upload up to 5 images. Please remove some files first.");
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    
    // Generate previews for new images
    validFiles.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews(prev => [...prev, '']);
      }
    });
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
        if (files.length >= 5) {
          toast.error("You can only upload up to 5 images. Please remove some files first.");
          return;
        }
        setFiles(prev => [...prev, pastedFile]);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(pastedFile);
        e.preventDefault();
      }
    }
  };

  // Remove file at specific index
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
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
    
    let file_urls: string[] = [];
    let file_names: string[] = [];
    
    if (files.length > 0) {
      const uploadPromises = files.map(file => uploadFile(file));
      const uploadResults = await Promise.all(uploadPromises);
      
      const failedUploads = uploadResults.filter(result => result === null);
      if (failedUploads.length > 0) {
        setLoading(false);
        return;
      }
      
      file_urls = uploadResults.map(result => result!.url);
      file_names = uploadResults.map(result => result!.name);
    }
    
    await onSubmit({ content, file_urls, file_names });
    setContent("");
    setFiles([]);
    setFilePreviews([]);
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
        <Label htmlFor="file">Attach Images (up to 5, max 2MB each)</Label>
        <input
          id="file"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        {files.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-600">
              {files.length}/5 images selected
            </p>
            <div className="grid grid-cols-2 gap-2">
              {files.map((file, index) => (
                <div key={index} className="relative border rounded p-2">
                  {filePreviews[index] ? (
                    <img 
                      src={filePreviews[index]} 
                      alt={`Preview ${index + 1}`} 
                      className="w-full h-32 object-cover rounded" 
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-sm text-gray-500">{file.name}</span>
                    </div>
                  )}
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 text-white hover:bg-red-600" 
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
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

// Edit Post Form Component
function EditPostForm({ 
  post, 
  onSubmit, 
  onCancel 
}: { 
  post: Post; 
  onSubmit: (data: { content: string, file_urls?: string[], file_names?: string[] }) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState(post.content);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const [keepExistingFiles, setKeepExistingFiles] = useState(true);
  const [removedExistingIndices, setRemovedExistingIndices] = useState<Set<number>>(new Set());

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`${file.name} is larger than 2MB. Please choose a smaller file.`);
        return false;
      }
      return true;
    });

    // Calculate total count: existing files (if keeping them, excluding removed ones) + current new files + new files being added
    const existingCount = keepExistingFiles ? (post.file_urls?.filter((_, index) => !removedExistingIndices.has(index)).length || 0) : 0;
    const currentNewCount = files.length;
    const totalCount = existingCount + currentNewCount + validFiles.length;
    
    if (totalCount > 5) {
      toast.error("You can only upload up to 5 images total. Please remove some files first.");
      return;
    }

    setFiles(prev => [...prev, ...validFiles]);
    
    // Generate previews for new images
    validFiles.forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreviews(prev => [...prev, '']);
      }
    });
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
        
        // Calculate total count: existing files (if keeping them, excluding removed ones) + current new files + 1 new file
        const existingCount = keepExistingFiles ? (post.file_urls?.filter((_, index) => !removedExistingIndices.has(index)).length || 0) : 0;
        const currentNewCount = files.length;
        const totalCount = existingCount + currentNewCount + 1;
        
        if (totalCount > 5) {
          toast.error("You can only upload up to 5 images total. Please remove some files first.");
          return;
        }
        
        setFiles(prev => [...prev, pastedFile]);
        const reader = new FileReader();
        reader.onload = (ev) => {
          setFilePreviews(prev => [...prev, ev.target?.result as string]);
        };
        reader.readAsDataURL(pastedFile);
        e.preventDefault();
      }
    }
  };

  // Remove file at specific index
  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Remove existing file at specific index
  const removeExistingFile = (index: number) => {
    setRemovedExistingIndices(prev => new Set([...prev, index]));
  };

  // Restore existing file at specific index
  const restoreExistingFile = (index: number) => {
    setRemovedExistingIndices(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
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
    
    let file_urls: string[] = [];
    let file_names: string[] = [];
    
    // Start with existing files if we're keeping them (excluding removed ones)
    if (keepExistingFiles && post.file_urls && post.file_urls.length > 0) {
      file_urls = post.file_urls.filter((_, index) => !removedExistingIndices.has(index));
      file_names = (post.file_names || []).filter((_, index) => !removedExistingIndices.has(index));
    }
    
    // Upload new files and add them to the existing ones
    if (files.length > 0) {
      const uploadPromises = files.map(file => uploadFile(file));
      const uploadResults = await Promise.all(uploadPromises);
      
      const failedUploads = uploadResults.filter(result => result === null);
      if (failedUploads.length > 0) {
        setLoading(false);
        return;
      }
      
      // Add new files to existing ones (don't overwrite)
      file_urls = [...file_urls, ...uploadResults.map(result => result!.url)];
      file_names = [...file_names, ...uploadResults.map(result => result!.name)];
    }
    
    await onSubmit({ content, file_urls, file_names });
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-content">Announcement Content</Label>
        <textarea
          id="edit-content"
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
        <Label htmlFor="edit-file">Attach Images (up to 5, max 2MB each)</Label>
        <input
          id="edit-file"
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
        
        {post.file_urls && post.file_urls.length > 0 && keepExistingFiles && (
          <div className="mt-2 p-2 bg-gray-50 rounded border">
            <p className="text-sm text-gray-600 mb-2">Current attachments:</p>
            <div className="grid grid-cols-2 gap-2">
              {post.file_urls.map((url, index) => {
                const isRemoved = removedExistingIndices.has(index);
                return (
                  <div key={index} className={`relative ${isRemoved ? 'opacity-50' : ''}`}>
                    <img 
                      src={url} 
                      alt={`Current attachment ${index + 1}`} 
                      className={`w-full h-24 object-cover rounded border ${isRemoved ? 'grayscale' : ''}`} 
                    />
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className={`absolute top-1 right-1 h-6 w-6 p-0 ${isRemoved ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'} text-white`}
                      onClick={() => isRemoved ? restoreExistingFile(index) : removeExistingFile(index)}
                    >
                      {isRemoved ? '↻' : '×'}
                    </Button>
                  </div>
                );
              })}
            </div>
            {removedExistingIndices.size > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {removedExistingIndices.size} image(s) marked for removal
              </p>
            )}
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="mt-2" 
              onClick={() => setKeepExistingFiles(false)}
            >
              Remove all current attachments
            </Button>
          </div>
        )}
        
        {files.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm text-gray-600">
              {files.length} new image(s) selected
              {keepExistingFiles && post.file_urls && post.file_urls.length > 0 && (
                <span className="ml-2 text-blue-600">
                  (+ {post.file_urls.length} existing)
                </span>
              )}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {files.map((file, index) => (
                <div key={index} className="relative border rounded p-2">
                  {filePreviews[index] ? (
                    <img 
                      src={filePreviews[index]} 
                      alt={`Preview ${index + 1}`} 
                      className="w-full h-32 object-cover rounded" 
                    />
                  ) : (
                    <div className="w-full h-32 bg-gray-100 rounded flex items-center justify-center">
                      <span className="text-sm text-gray-500">{file.name}</span>
                    </div>
                  )}
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="absolute top-1 right-1 h-6 w-6 p-0 bg-red-500 text-white hover:bg-red-600" 
                    onClick={() => removeFile(index)}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Updating..." : "Update Announcement"}
        </Button>
      </div>
    </form>
  );
} 