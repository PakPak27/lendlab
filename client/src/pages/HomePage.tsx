import SystemStatus from '../components/SystemStatus';

// Temporary landing page for Issue #3. Replaced by role-based routing in Issue #4.
export default function HomePage() {
  return (
    <div className="mx-auto" style={{ maxWidth: 640 }}>
      <h1 className="h3 mb-2">LendLab</h1>
      <p className="text-secondary">CPE Department Equipment Lending System</p>
      <SystemStatus />
    </div>
  );
}
