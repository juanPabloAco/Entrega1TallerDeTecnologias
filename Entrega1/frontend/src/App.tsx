import { useAccount } from "wagmi"
import { ConnectSection } from "./components/ConnectSection"
import { AccountPanel } from "./components/AccountPanel"
import { TokenBalances } from "./components/TokenBalances"

function App() {
  const { isConnected } = useAccount()

  return (
    <div style={{
      maxWidth: "800px",
      margin: "0 auto",
      fontFamily: "system-ui, sans-serif",
      padding: "40px 20px",
      minHeight: "100vh",
    }}>
      {isConnected ? (
        <>
          <AccountPanel />
          <TokenBalances />
        </>
      ) : (
        <ConnectSection />
      )}
    </div>
  )
}

export default App
