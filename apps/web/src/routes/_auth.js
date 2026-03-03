import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute, Outlet, Link } from '@tanstack/react-router';
export const Route = createFileRoute('/_auth')({
    beforeLoad: async () => {
        // Basic session guard - commented so dashboard is viewable without backend running during dev
        // const { data: session } = await authClient.getSession()
        // if (!session) throw redirect({ to: '/login' })
    },
    component: () => (_jsxs("div", { className: "flex h-screen w-full", children: [_jsxs("aside", { className: "w-64 bg-primary text-primary-foreground h-full p-4 flex flex-col gap-2", children: [_jsx("h2", { className: "text-xl font-bold mb-4", children: "Sunshine Dental" }), _jsx(Link, { to: "/", className: "p-2 hover:bg-slate-700 rounded", children: "> Dashboard" }), _jsx(Link, { to: "/calendar", className: "p-2 hover:bg-slate-700 rounded", children: "> Calendar" }), _jsx(Link, { to: "/appointments", className: "p-2 hover:bg-slate-700 rounded", children: "> Appointments" }), _jsx(Link, { to: "/patients", className: "p-2 hover:bg-slate-700 rounded", children: "> Patients" })] }), _jsx("main", { className: "flex-1 w-full bg-slate-50 p-6 overflow-auto", children: _jsx(Outlet, {}) })] })),
});
