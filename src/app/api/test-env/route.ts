import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    // Check database state
    const results: any = {
      students: null,
      classes: null,
      posts: null,
      postTags: null,
      studentClass: null,
      teachers: null
    }

    // Check students
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id, name, class_id')
      .limit(5)

    results.students = { data: students, error: studentsError?.message }

    // Check classes
    const { data: classes, error: classesError } = await supabase
      .from('classes')
      .select('id, name, teacher_id')
      .limit(5)

    results.classes = { data: classes, error: classesError?.message }

    // Check posts
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, content, class_id, teacher_id')
      .limit(5)

    results.posts = { data: posts, error: postsError?.message }

    // Check post tags
    const { data: postTags, error: postTagsError } = await supabase
      .from('post_student_tags')
      .select('post_id, student_id')
      .limit(5)

    results.postTags = { data: postTags, error: postTagsError?.message }

    // Check student_class table
    const { data: studentClass, error: studentClassError } = await supabase
      .from('student_class')
      .select('student_id, class_id')
      .limit(5)

    results.studentClass = { data: studentClass, error: studentClassError?.message }

    // Check teachers
    const { data: teachers, error: teachersError } = await supabase
      .from('teachers')
      .select('id, name, email')
      .limit(5)

    results.teachers = { data: teachers, error: teachersError?.message }

    return NextResponse.json({
      success: true,
      message: 'Database state check',
      results
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 