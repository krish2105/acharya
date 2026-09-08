import { GeneratePage } from '../generate-page';

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <GeneratePage kind="lesson_plan" current="/saarthi/plan" searchParams={searchParams} />;
}
