import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { createRootRoute, Outlet } from '@tanstack/react-router';
export const Route = createRootRoute({
    component: () => (_jsx(_Fragment, { children: _jsx(Outlet, {}) })),
});
