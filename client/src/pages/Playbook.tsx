import DashboardLayout from "@/components/DashboardLayout";
import { ResourceLayout } from "@/components/ResourceLayout";
import { playbookSections } from "@/lib/salesOpsContent";

export default function Playbook() {
  return (
    <DashboardLayout>
      <ResourceLayout kind="playbook" sections={playbookSections} />
    </DashboardLayout>
  );
}
