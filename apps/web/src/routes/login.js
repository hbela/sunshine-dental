import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/login')({
    component: () => (_jsx("div", { className: "flex h-screen items-center justify-center bg-gray-50", children: _jsxs("div", { className: "w-full max-w-md p-8 bg-white rounded shadow text-center", children: [_jsx("h1", { className: "text-2xl font-bold mb-6", children: "Sunshine Dental Clinic" }), _jsx("p", { className: "mb-4", children: "Please log in to manage your appointments." }), _jsx("button", { className: "bg-primary text-primary-foreground px-4 py-2 rounded", children: "Login Placeholder" })] }) })),
});
