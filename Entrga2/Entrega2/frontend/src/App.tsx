import { Header } from "@/components/Header";
import { ContractInfo } from "@/components/ContractInfo";
import { ProposalForm } from "@/components/ProposalForm";
import { ProposalList } from "@/components/ProposalList";
import { NotSignerBanner } from "@/components/NotSignerBanner";

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <NotSignerBanner />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ContractInfo />
          </div>
          <div className="lg:col-span-2">
            <ProposalForm />
          </div>
        </div>
        <ProposalList />
        <footer className="pt-6 text-center text-xs text-slate-600">
          Programmatic multisig · Hardhat + Vite + Wagmi v2 + RainbowKit
        </footer>
      </main>
    </div>
  );
}
