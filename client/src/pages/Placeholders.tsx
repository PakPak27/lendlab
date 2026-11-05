// Temporary landing pages so sign-in has somewhere to go.
// F-03 (Catalog) and F-04 (My Borrowing) replace these.
function Placeholder({ testId, title }: { testId: string; title: string }) {
  return (
    <div data-testid={testId}>
      <h1 className="h3">{title}</h1>
      <p className="text-secondary">This screen arrives with a later Sprint 1 feature.</p>
    </div>
  );
}

export const CatalogPlaceholder = () => <Placeholder testId="page-catalog" title="Catalog" />;
export const MyBorrowingPlaceholder = () => <Placeholder testId="page-my-borrowing" title="My Borrowing" />;
