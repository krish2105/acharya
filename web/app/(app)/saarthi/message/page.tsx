import { GeneratePage } from '../generate-page';

export default function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return <GeneratePage kind="parent_message" current="/saarthi/message" searchParams={searchParams} />;
}
