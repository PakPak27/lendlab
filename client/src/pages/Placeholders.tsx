// Temporary landing pages so sign-in has somewhere to go.
// F-05 (Request queue) replaces this.
function Placeholder({ testId, title }: { testId: string; title: string }) {
  return (
    <div data-testid={testId}>
      <h1 className="h3">{title}</h1>
      <p className="text-secondary">This screen arrives with a later Sprint 1 feature.</p>
    </div>
  );
}

export const CustodianRequestsPlaceholder = () => (
  <Placeholder testId="page-custodian-requests" title="Requests" />
);
