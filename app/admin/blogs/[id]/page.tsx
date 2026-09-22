import { notFound } from "next/navigation";
import BlogEditor from "@/components/admin/BlogEditor";
import { BLOG_UUID } from "@/lib/blog";
export default async function EditBlogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!BLOG_UUID.test(id)) notFound();
  return <BlogEditor id={id} />;
}
