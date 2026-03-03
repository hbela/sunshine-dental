import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/_auth/')({
    component: () => (_jsxs("div", { children: [_jsx("h1", { className: "text-3xl font-semibold mb-6 text-gray-800", children: "Dashboard" }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", children: ['Appointments Today', 'Pending Callbacks', 'Calls This Week', 'Sentiment Score'].map(stat => (_jsxs("div", { className: "bg-white p-6 rounded shadow border", children: [_jsx("h3", { className: "text-sm font-medium text-gray-500", children: stat }), _jsx("p", { className: "text-2xl font-bold mt-2 text-gray-900", children: "-" })] }, stat))) })] })),
});
