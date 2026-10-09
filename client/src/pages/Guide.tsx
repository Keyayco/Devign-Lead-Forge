import DashboardLayout from "@/components/DashboardLayout";
import { ResourceLayout } from "@/components/ResourceLayout";
import { guideSections } from "@/lib/salesOpsContent";

export default function Guide() {
  return (
    <DashboardLayout>
      <ResourceLayout kind="guide" sections={guideSections} />
    </DashboardLayout>
  );
}
