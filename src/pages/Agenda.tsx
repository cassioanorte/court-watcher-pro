import DashboardCalendar from "@/components/DashboardCalendar";

const Agenda = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Agenda</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie seus compromissos</p>
      </div>
      <DashboardCalendar />
    </div>
  );
};

export default Agenda;
