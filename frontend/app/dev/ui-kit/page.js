import { notFound } from "next/navigation";
import UiKit from "./ui-kit";
import "./ui-kit.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "ชุดองค์ประกอบหน้าจอ · เฟส 1", robots: { index: false, follow: false } };

export default function UiKitPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiKit />;
}
