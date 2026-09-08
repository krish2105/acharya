import { GeneratePage } from '../generate-page';

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <GeneratePage kind="activity" current="/saarthi/activity" searchParams={searchParams} />;
}
