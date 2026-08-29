import { ReviewSession } from "@/components/review/ReviewSession";

export default function ReviewPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">复习</h1>
      <ReviewSession />
    </div>
  );
}
