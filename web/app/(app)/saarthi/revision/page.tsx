import { GeneratePage } from '../generate-page';

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <GeneratePage kind="revision_sheet" current="/saarthi/revision" searchParams={searchParams} />;
}
