import { GeneratePage } from '../generate-page';

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <GeneratePage kind="rubric" current="/saarthi/rubric" searchParams={searchParams} />;
}
