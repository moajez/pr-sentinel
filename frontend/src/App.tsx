import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout/Layout";
import Dashboard from "./components/Dashboard/Dashboard";
import ReviewList from "./components/ReviewDetail/ReviewList";
import ReviewDetailPage from "./components/ReviewDetail/ReviewDetailPage";
import SecurityEvals from "./components/SecurityEvals/SecurityEvals";
import Settings from "./components/Settings/Settings";
import Compliance from "./components/Compliance/Compliance";
import Governance from "./components/Governance/Governance";
import Audit from "./components/Audit/Audit";
import CICDIntegration from "./components/CICD/CICDIntegration";
import EnterpriseSecurity from "./components/Identity/EnterpriseSecurity";
import SafeRemediation from "./components/Remediation/SafeRemediation";
import ProductGuide from "./components/ProductGuide/ProductGuide";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reviews" element={<ReviewList />} />
        <Route path="/reviews/:id" element={<ReviewDetailPage />} />
        <Route path="/cicd" element={<CICDIntegration />} />
        <Route path="/identity" element={<EnterpriseSecurity />} />
        <Route path="/remediation" element={<SafeRemediation />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/governance" element={<Governance />} />
        <Route path="/evals" element={<SecurityEvals />} />
        <Route path="/audit" element={<Audit />} />
        <Route path="/guide" element={<ProductGuide />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  );
}
