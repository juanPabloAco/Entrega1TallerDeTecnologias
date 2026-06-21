import { Header } from "@/components/Header";
import { JobBoard } from "@/components/JobBoard";
import { CreateJobForm } from "@/components/CreateJobForm";
import { ContractInfo } from "@/components/ContractInfo";
import { NotSignerBanner } from "@/components/NotSignerBanner";

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
        <footer className="pt-6 text-center text-xs text-slate-600">
          Job Marketplace · Hardhat + Vite + Wagmi v2 + RainbowKit
        </footer>
      </main>
    </div>
  );
}
