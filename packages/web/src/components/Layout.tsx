import { NavLink, Outlet } from 'react-router-dom'
import {
    LayoutDashboard,
    Target,
    LineChart,
    Wrench,
    Sparkles,
    FileSearch
} from 'lucide-react'

const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/slo', icon: Target, label: 'SLO Workflow' },
    { to: '/metrics', icon: LineChart, label: 'Metrics Explorer' },
    { to: '/logs', icon: FileSearch, label: 'Log Explorer' },
    { to: '/tools', icon: Wrench, label: 'Tool Browser' },
]

export function Layout() {
    return (
        <div className="flex h-screen bg-[hsl(var(--background))]">
            {/* Sidebar */}
            <aside className="w-64 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))]">
                {/* Logo */}
                <div className="flex items-center gap-3 p-6 border-b border-[hsl(var(--border))]">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg">SRE AI Agent</h1>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">Intelligent SLO Management</p>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="p-4 space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.to === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${isActive
                                    ? 'bg-[hsl(var(--primary))] text-white'
                                    : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] hover:text-[hsl(var(--foreground))]'
                                }`
                            }
                        >
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.label}</span>
                        </NavLink>
                    ))}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
