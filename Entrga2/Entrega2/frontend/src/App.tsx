import { Header } from "@/components/Header";
import { JobBoard } from "@/components/JobBoard";
import { CreateJobForm } from "@/components/CreateJobForm";
import { ContractInfo } from "@/components/ContractInfo";
import { NotSignerBanner } from "@/components/NotSignerBanner";
import { ProposalForm } from "@/components/ProposalForm";
import { ProposalList } from "@/components/ProposalList";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <NotSignerBanner />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ContractInfo />
          </div>
          <div className="lg:col-span-2">
            <CreateJobForm />
          </div>
        </div>
        <JobBoard />
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">Multisig</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <ProposalForm />
            </div>
            <div className="lg:col-span-2">
              <ProposalList />
            </div>
          </div>
        </section>
        <footer className="pt-6 text-center text-xs text-slate-600">
          Job Marketplace · Hardhat + Vite + Wagmi v2 + RainbowKit
        </footer>
      </main>
    </div>
  );
}
