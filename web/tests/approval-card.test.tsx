import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalCard } from '@/components/shared/approval-card';

const outcome = {
  frameworkCode: 'CBSE',
  refCode: 'CBSE.SCI.10.4.2',
  statement: 'Explain the process of photosynthesis in green plants.',
};

describe('ApprovalCard', () => {
  it('renders without throwing, showing both versions and the outcome chip', () => {
    render(
      <ApprovalCard
        title="Photosynthesis worksheet"
        outcome={outcome}
        generatedText="Photosynthesis converts light to energy."
        finalText="Photosynthesis converts sunlight into chemical energy."
        approved={false}
      />,
    );

    expect(screen.getByText('Photosynthesis worksheet')).toBeInTheDocument();
    expect(screen.getByText('CBSE.SCI.10.4.2')).toBeInTheDocument();
    expect(screen.getByText('Awaiting teacher approval')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
  });

  it('calls onApprove when the Approve button is clicked', async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    render(
      <ApprovalCard
        title="Photosynthesis worksheet"
        outcome={outcome}
        generatedText="Photosynthesis converts light to energy."
        finalText="Photosynthesis converts sunlight into chemical energy."
        approved={false}
        onApprove={onApprove}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(onApprove).toHaveBeenCalledOnce();
  });

  it('shows "Approved" and disables the button once approved', () => {
    render(
      <ApprovalCard
        title="Photosynthesis worksheet"
        outcome={outcome}
        generatedText="Photosynthesis converts light to energy."
        finalText="Photosynthesis converts sunlight into chemical energy."
        approved
      />,
    );

    expect(screen.getByTestId('approval-status')).toHaveTextContent('Approved');
    expect(screen.getByRole('button', { name: 'Approved' })).toBeDisabled();
  });
});
