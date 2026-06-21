import { apiRoutes } from "@waxonedge/api-contracts";

export function App() {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">WaxOnEdge</p>
        <h1>Web shell</h1>
        <p>
          API contracts are wired. The status endpoint is exposed as{" "}
          <code>{apiRoutes.status}</code>.
        </p>
      </section>
    </main>
  );
}
