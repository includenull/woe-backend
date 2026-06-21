import { apiRoutes } from "@waxonedge/api-contracts";

export function App() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f3] p-8 font-sans text-[#162019]">
      <section className="max-w-2xl">
        <p className="mb-3 text-[0.8125rem] font-bold text-[#4d6a56] uppercase">
          WaxOnEdge
        </p>
        <h1 className="mb-4 text-5xl leading-tight font-bold [text-wrap:balance]">
          Web shell
        </h1>
        <p className="text-lg leading-relaxed text-[#3d493f]">
          API contracts are wired. The status endpoint is exposed as{" "}
          <code className="rounded bg-[#e8ece2] px-1.5 py-0.5">
            {apiRoutes.status}
          </code>
          .
        </p>
      </section>
    </main>
  );
}
