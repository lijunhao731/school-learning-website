import { MistakeUploadWizard } from "@/components/mistake/MistakeUploadWizard";

export default function UploadPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">上传错题</h1>
      <MistakeUploadWizard />
    </div>
  );
}
