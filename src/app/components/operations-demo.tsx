import { useState } from 'react';
import { ProjectSelector } from './project-selector';
import { ShiftChoice } from './shift-choice';
import { ShiftSetup, ShiftSetupData } from './shift-setup';
import { CurrentStock } from './current-stock';
import { ShiftEnd } from './shift-end';
import { QuickSales } from './quick-sales';


interface Project {
  id: string;
  name: string;
  location: string;
  shift: string;
  color: string;
  icon: string;
}

interface OperationsDemoProps {
  userName: string;
  userRole: 'yonetici' | 'ust-mudur' | 'mudur' | 'operasyon' | 'personel' | 'idari' | 'bekleyen';
  onLogout: () => void;
  onNavigate: (tab: string) => void;
}

type DemoView = 'project-select' | 'shift-choice' | 'shift-setup' | 'quick-sales' | 'current-stock' | 'shift-end';

export function OperationsDemo({ userName, userRole, onLogout, onNavigate }: OperationsDemoProps) {
  const [currentView, setCurrentView] = useState<DemoView>('project-select');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [shiftSetupData, setShiftSetupData] = useState<ShiftSetupData | null>(null);

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project);
    setCurrentView('shift-choice');
  };

  const handleStartShiftSetup = () => {
    setCurrentView('shift-setup');
  };

  const handleStartSales = () => {
    setCurrentView('quick-sales');
  };

  const handleViewStock = () => {
    setCurrentView('current-stock');
  };

  const handleEndShift = () => {
    setCurrentView('shift-end');
  };

  const handleShiftSetupComplete = (data: ShiftSetupData) => {
    setShiftSetupData(data);
    setCurrentView('shift-choice');
  };

  const handleBackToChoice = () => {
    setCurrentView('shift-choice');
  };

  const handleBackToProjectSelect = () => {
    setCurrentView('project-select');
    setSelectedProject(null);
  };

  const handleProjectSelectInSales = (projectName: string) => {
    // QuickSales içinden proje değişimi için
    console.log('Project changed to:', projectName);
  };

  // Render based on current view
  if (currentView === 'project-select') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#2a2a3a] via-[#3a3a4e] to-[#2f3439]">
        <div className="pb-20 pt-4">
          <ProjectSelector 
            onProjectSelect={handleProjectSelect}
            selectedProject={selectedProject}
            onNavigate={onNavigate}
          />
        </div>
      </div>
    );
  }

  if (currentView === 'shift-choice' && selectedProject) {
    return (
      <ShiftChoice
        userName={userName}
        userRole={userRole}
        projectName={selectedProject.name}
        onStartShiftSetup={handleStartShiftSetup}
        onStartSales={handleStartSales}
        onViewStock={handleViewStock}
        onEndShift={handleEndShift}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onBack={handleBackToProjectSelect}
      />
    );
  }

  if (currentView === 'shift-setup' && selectedProject) {
    return (
      <ShiftSetup
        userName={userName}
        userRole={userRole}
        projectName={selectedProject.name}
        onComplete={handleShiftSetupComplete}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onBack={handleBackToChoice}
      />
    );
  }

  if (currentView === 'quick-sales') {
    return (
      <QuickSales
        userName={userName}
        userRole={userRole}
        onProjectSelect={handleProjectSelectInSales}
        preSelectedProject={selectedProject?.name}
        onLogout={onLogout}
        onNavigate={onNavigate}
        onBack={handleBackToChoice}
      />
    );
  }

  if (currentView === 'current-stock' && selectedProject) {
    return (
      <CurrentStock
        userName={userName}
        userRole={userRole}
        projectName={selectedProject.name}
        onBack={handleBackToChoice}
        onLogout={onLogout}
        onNavigate={onNavigate}
      />
    );
  }

  if (currentView === 'shift-end' && selectedProject) {
    return (
      <ShiftEnd
        userName={userName}
        userRole={userRole}
        projectName={selectedProject.name}
        onBack={handleBackToChoice}
        onLogout={onLogout}
        onNavigate={onNavigate}
      />
    );
  }

  // Fallback
  return null;
}