export declare const authClient: {
    admin: {
        setRole: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: string;
            role: "user" | "admin" | ("user" | "admin")[];
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: string;
            role: "user" | "admin" | ("user" | "admin")[];
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            user: import("better-auth/plugins").UserWithRole;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        getUser: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
            id: string;
        }> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            query: {
                id: string;
            };
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<import("better-auth/plugins").UserWithRole, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        createUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            email: string;
            password?: string | undefined;
            name: string;
            role?: "user" | "admin" | ("user" | "admin")[] | undefined;
            data?: Record<string, any> | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            email: string;
            password?: string | undefined;
            name: string;
            role?: "user" | "admin" | ("user" | "admin")[] | undefined;
            data?: Record<string, any> | undefined;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            user: import("better-auth/plugins").UserWithRole;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        updateUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
            data: Record<any, any>;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
            data: Record<any, any>;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<import("better-auth/plugins").UserWithRole, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        listUsers: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
            searchValue?: string | undefined;
            searchField?: "email" | "name" | undefined;
            searchOperator?: "contains" | "starts_with" | "ends_with" | undefined;
            limit?: string | number | undefined;
            offset?: string | number | undefined;
            sortBy?: string | undefined;
            sortDirection?: "asc" | "desc" | undefined;
            filterField?: string | undefined;
            filterValue?: string | number | boolean | string[] | number[] | undefined;
            filterOperator?: "in" | "contains" | "starts_with" | "ends_with" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "not_in" | undefined;
        }> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            query: {
                searchValue?: string | undefined;
                searchField?: "email" | "name" | undefined;
                searchOperator?: "contains" | "starts_with" | "ends_with" | undefined;
                limit?: string | number | undefined;
                offset?: string | number | undefined;
                sortBy?: string | undefined;
                sortDirection?: "asc" | "desc" | undefined;
                filterField?: string | undefined;
                filterValue?: string | number | boolean | string[] | number[] | undefined;
                filterOperator?: "in" | "contains" | "starts_with" | "ends_with" | "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "not_in" | undefined;
            };
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            users: import("better-auth/plugins").UserWithRole[];
            total: number;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        listUserSessions: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        unbanUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            user: import("better-auth/plugins").UserWithRole;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        banUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
            banReason?: string | undefined;
            banExpiresIn?: number | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
            banReason?: string | undefined;
            banExpiresIn?: number | undefined;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            user: import("better-auth/plugins").UserWithRole;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        impersonateUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            };
            user: import("better-auth/plugins").UserWithRole;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        stopImpersonating: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
            query?: Record<string, any> | undefined;
            fetchOptions?: FetchOptions | undefined;
        }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            session: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            } & Record<string, any>;
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & Record<string, any>;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        revokeUserSession: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            sessionToken: string;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            sessionToken: string;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            success: boolean;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        revokeUserSessions: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            success: boolean;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        removeUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            success: boolean;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        setUserPassword: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            newPassword: string;
            userId: unknown;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            newPassword: string;
            userId: unknown;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            status: boolean;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    admin: {
        hasPermission: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            permissions: {
                readonly user?: ("create" | "list" | "set-role" | "ban" | "impersonate" | "impersonate-admins" | "delete" | "set-password" | "get" | "update")[] | undefined;
                readonly session?: ("list" | "delete" | "revoke")[] | undefined;
            };
        } & {
            userId?: string | undefined;
            role?: "user" | "admin" | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            permissions: {
                readonly user?: ("create" | "list" | "set-role" | "ban" | "impersonate" | "impersonate-admins" | "delete" | "set-password" | "get" | "update")[] | undefined;
                readonly session?: ("list" | "delete" | "revoke")[] | undefined;
            };
        } & {
            userId?: string | undefined;
            role?: "user" | "admin" | undefined;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            error: null;
            success: boolean;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    signIn: {
        social: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            provider: (string & {}) | "linear" | "huggingface" | "github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "railway" | "vercel";
            callbackURL?: string | undefined;
            newUserCallbackURL?: string | undefined;
            errorCallbackURL?: string | undefined;
            disableRedirect?: boolean | undefined;
            idToken?: {
                token: string;
                nonce?: string | undefined;
                accessToken?: string | undefined;
                refreshToken?: string | undefined;
                expiresAt?: number | undefined;
            } | undefined;
            scopes?: string[] | undefined;
            requestSignUp?: boolean | undefined;
            loginHint?: string | undefined;
            additionalData?: Record<string, any> | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            provider: (string & {}) | "linear" | "huggingface" | "github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "railway" | "vercel";
            callbackURL?: string | undefined;
            newUserCallbackURL?: string | undefined;
            errorCallbackURL?: string | undefined;
            disableRedirect?: boolean | undefined;
            idToken?: {
                token: string;
                nonce?: string | undefined;
                accessToken?: string | undefined;
                refreshToken?: string | undefined;
                expiresAt?: number | undefined;
            } | undefined;
            scopes?: string[] | undefined;
            requestSignUp?: boolean | undefined;
            loginHint?: string | undefined;
            additionalData?: Record<string, any> | undefined;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            redirect: boolean;
            url: string;
        } | (Omit<{
            redirect: boolean;
            token: string;
            url: undefined;
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        }, "user"> & {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
        }), {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    signOut: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: Record<string, any> | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        success: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    signUp: {
        email: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            name: string;
            email: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            email: string;
            name: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            fetchOptions?: FetchOptions | undefined;
        } & {} & {}>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<(Omit<{
            token: null;
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        }, "user"> & {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
        }) | (Omit<{
            token: string;
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        }, "user"> & {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
        }), {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    signIn: {
        email: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
        }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
        } & {
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<Omit<{
            redirect: boolean;
            token: string;
            url?: string | undefined;
            user: {
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined | undefined;
            };
        }, "user"> & {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    resetPassword: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        newPassword: string;
        token?: string | undefined;
    }> & Record<string, any>, Partial<{
        token?: string | undefined;
    }> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        newPassword: string;
        token?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    verifyEmail: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
        token: string;
        callbackURL?: string | undefined;
    }> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        query: {
            token: string;
            callbackURL?: string | undefined;
        };
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<NonNullable<void | {
        status: boolean;
    }>, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    sendVerificationEmail: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        email: string;
        callbackURL?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        email: string;
        callbackURL?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    changeEmail: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        newEmail: string;
        callbackURL?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        newEmail: string;
        callbackURL?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    changePassword: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        newPassword: string;
        currentPassword: string;
        revokeOtherSessions?: boolean | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        newPassword: string;
        currentPassword: string;
        revokeOtherSessions?: boolean | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<Omit<{
        token: string | null;
        user: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
        } & Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
        };
    }, "user"> & {
        user: import("better-auth").StripEmptyObjects<{
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
        } & {
            banned: boolean | null | undefined;
        } & {
            role?: string | null | undefined;
            banReason?: string | null | undefined;
            banExpires?: Date | null | undefined;
        }>;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    updateSession: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<Partial<{}>> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<Partial<{}> & {
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        session: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
        };
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    updateUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<Partial<{}> & {
        name?: string | undefined;
        image?: string | undefined | null;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        image?: (string | null) | undefined;
        name?: string | undefined;
        fetchOptions?: FetchOptions | undefined;
    } & Partial<{} & {}>> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    deleteUser: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        callbackURL?: string | undefined;
        password?: string | undefined;
        token?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        callbackURL?: string | undefined;
        password?: string | undefined;
        token?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        success: boolean;
        message: string;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    requestPasswordReset: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        email: string;
        redirectTo?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        email: string;
        redirectTo?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
        message: string;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    resetPassword: {
        ":token": <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
            callbackURL: string;
        }> & Record<string, any>, {
            token: string;
        }>>(data_0: import("better-auth").Prettify<{
            query: {
                callbackURL: string;
            };
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<never, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    listSessions: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: Record<string, any> | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<import("better-auth").Prettify<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined | undefined;
        userAgent?: string | null | undefined | undefined;
    }>[], {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    revokeSession: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        token: string;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        token: string;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    revokeSessions: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: Record<string, any> | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    revokeOtherSessions: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: Record<string, any> | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    linkSocial: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        provider: unknown;
        callbackURL?: string | undefined;
        idToken?: {
            token: string;
            nonce?: string | undefined;
            accessToken?: string | undefined;
            refreshToken?: string | undefined;
            scopes?: string[] | undefined;
        } | undefined;
        requestSignUp?: boolean | undefined;
        scopes?: string[] | undefined;
        errorCallbackURL?: string | undefined;
        disableRedirect?: boolean | undefined;
        additionalData?: Record<string, any> | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        provider: unknown;
        callbackURL?: string | undefined;
        idToken?: {
            token: string;
            nonce?: string | undefined;
            accessToken?: string | undefined;
            refreshToken?: string | undefined;
            scopes?: string[] | undefined;
        } | undefined;
        requestSignUp?: boolean | undefined;
        scopes?: string[] | undefined;
        errorCallbackURL?: string | undefined;
        disableRedirect?: boolean | undefined;
        additionalData?: Record<string, any> | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        url: string;
        redirect: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    listAccounts: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: Record<string, any> | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        scopes: string[];
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        providerId: string;
        accountId: string;
    }[], {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    deleteUser: {
        callback: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
            token: string;
            callbackURL?: string | undefined;
        }> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
            query: {
                token: string;
                callbackURL?: string | undefined;
            };
            fetchOptions?: FetchOptions | undefined;
        }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
            success: boolean;
            message: string;
        }, {
            code?: string | undefined;
            message?: string | undefined;
        }, FetchOptions["throw"] extends true ? true : false>>;
    };
} & {
    unlinkAccount: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        providerId: string;
        accountId?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        providerId: string;
        accountId?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        status: boolean;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    refreshToken: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        providerId: string;
        accountId?: string | undefined;
        userId?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        providerId: string;
        accountId?: string | undefined;
        userId?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        accessToken: string | undefined;
        refreshToken: string;
        accessTokenExpiresAt: Date | undefined;
        refreshTokenExpiresAt: Date | null | undefined;
        scope: string | null | undefined;
        idToken: string | null | undefined;
        providerId: string;
        accountId: string;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    getAccessToken: <FetchOptions extends import("better-auth").ClientFetchOption<Partial<{
        providerId: string;
        accountId?: string | undefined;
        userId?: string | undefined;
    }> & Record<string, any>, Partial<Record<string, any>> & Record<string, any>, Record<string, any> | undefined>>(data_0: import("better-auth").Prettify<{
        providerId: string;
        accountId?: string | undefined;
        userId?: string | undefined;
    } & {
        fetchOptions?: FetchOptions | undefined;
    }>, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        accessToken: string;
        accessTokenExpiresAt: Date | undefined;
        scopes: string[];
        idToken: string | undefined;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    accountInfo: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
        accountId?: string | undefined;
    }> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: {
            accountId?: string | undefined;
        } | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        user: import("better-auth").OAuth2UserInfo;
        data: Record<string, any>;
    }, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    getSession: <FetchOptions extends import("better-auth").ClientFetchOption<never, Partial<{
        disableCookieCache?: unknown;
        disableRefresh?: unknown;
    }> & Record<string, any>, Record<string, any> | undefined>>(data_0?: import("better-auth").Prettify<{
        query?: {
            disableCookieCache?: unknown;
            disableRefresh?: unknown;
        } | undefined;
        fetchOptions?: FetchOptions | undefined;
    }> | undefined, data_1?: FetchOptions | undefined) => Promise<import("better-auth/react").BetterFetchResponse<{
        user: import("better-auth").StripEmptyObjects<{
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
        } & {
            banned: boolean | null | undefined;
        } & {
            role?: string | null | undefined;
            banReason?: string | null | undefined;
            banExpires?: Date | null | undefined;
        }>;
        session: import("better-auth").StripEmptyObjects<{
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
        } & {} & {
            impersonatedBy?: string | null | undefined;
        }>;
    } | null, {
        code?: string | undefined;
        message?: string | undefined;
    }, FetchOptions["throw"] extends true ? true : false>>;
} & {
    admin: {
        checkRolePermission: <R extends "user" | "admin">(data: {
            permissions: {
                readonly user?: ("create" | "list" | "set-role" | "ban" | "impersonate" | "impersonate-admins" | "delete" | "set-password" | "get" | "update")[] | undefined;
                readonly session?: ("list" | "delete" | "revoke")[] | undefined;
            };
        } & {
            role: R;
        }) => boolean;
    };
} & {
    useSession: () => {
        data: {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
            session: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            } & {} & {
                impersonatedBy?: string | null | undefined;
            }>;
        } | null;
        isPending: boolean;
        isRefetching: boolean;
        error: import("better-auth/react").BetterFetchError | null;
        refetch: (queryParams?: {
            query?: import("better-auth").SessionQueryParams;
        } | undefined) => Promise<void>;
    };
    $Infer: {
        Session: {
            user: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                email: string;
                emailVerified: boolean;
                name: string;
                image?: string | null | undefined;
            } & {
                banned: boolean | null | undefined;
            } & {
                role?: string | null | undefined;
                banReason?: string | null | undefined;
                banExpires?: Date | null | undefined;
            }>;
            session: import("better-auth").StripEmptyObjects<{
                id: string;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                expiresAt: Date;
                token: string;
                ipAddress?: string | null | undefined;
                userAgent?: string | null | undefined;
            } & {} & {
                impersonatedBy?: string | null | undefined;
            }>;
        };
    };
    $fetch: import("better-auth/react").BetterFetch<{
        plugins: (import("better-auth/react").BetterFetchPlugin<Record<string, any>> | {
            id: string;
            name: string;
            hooks: {
                onSuccess(context: import("better-auth/react").SuccessContext<any>): void;
            };
        } | {
            id: string;
            name: string;
            hooks: {
                onSuccess: ((context: import("better-auth/react").SuccessContext<any>) => Promise<void> | void) | undefined;
                onError: ((context: import("better-auth/react").ErrorContext) => Promise<void> | void) | undefined;
                onRequest: (<T extends Record<string, any>>(context: import("better-auth/react").RequestContext<T>) => Promise<import("better-auth/react").RequestContext | void> | import("better-auth/react").RequestContext | void) | undefined;
                onResponse: ((context: import("better-auth/react").ResponseContext) => Promise<Response | void | import("better-auth/react").ResponseContext> | Response | import("better-auth/react").ResponseContext | void) | undefined;
            };
        })[];
        cache?: RequestCache | undefined;
        priority?: RequestPriority | undefined;
        credentials?: RequestCredentials;
        headers?: (HeadersInit & (HeadersInit | {
            accept: "application/json" | "text/plain" | "application/octet-stream";
            "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
            authorization: "Bearer" | "Basic";
        })) | undefined;
        integrity?: string | undefined;
        keepalive?: boolean | undefined;
        method: string;
        mode?: RequestMode | undefined;
        redirect?: RequestRedirect | undefined;
        referrer?: string | undefined;
        referrerPolicy?: ReferrerPolicy | undefined;
        signal?: (AbortSignal | null) | undefined;
        window?: null | undefined;
        onRetry?: ((response: import("better-auth/react").ResponseContext) => Promise<void> | void) | undefined;
        hookOptions?: {
            cloneResponse?: boolean;
        } | undefined;
        timeout?: number | undefined;
        customFetchImpl: import("better-auth/react").FetchEsque;
        baseURL: string;
        throw?: boolean | undefined;
        auth?: ({
            type: "Bearer";
            token: string | Promise<string | undefined> | (() => string | Promise<string | undefined> | undefined) | undefined;
        } | {
            type: "Basic";
            username: string | (() => string | undefined) | undefined;
            password: string | (() => string | undefined) | undefined;
        } | {
            type: "Custom";
            prefix: string | (() => string | undefined) | undefined;
            value: string | (() => string | undefined) | undefined;
        }) | undefined;
        body?: any;
        query?: any;
        params?: any;
        duplex?: "full" | "half" | undefined;
        jsonParser: (text: string) => Promise<any> | any;
        retry?: import("better-auth/react").RetryOptions | undefined;
        retryAttempt?: number | undefined;
        output?: (import("better-auth/react").StandardSchemaV1 | typeof Blob | typeof File) | undefined;
        errorSchema?: import("better-auth/react").StandardSchemaV1 | undefined;
        disableValidation?: boolean | undefined;
        disableSignal?: boolean | undefined;
    }, unknown, unknown, {}>;
    $store: {
        notify: (signal?: (Omit<string, "$sessionSignal"> | "$sessionSignal") | undefined) => void;
        listen: (signal: Omit<string, "$sessionSignal"> | "$sessionSignal", listener: (value: boolean, oldValue?: boolean | undefined) => void) => void;
        atoms: Record<string, import("better-auth/react").WritableAtom<any>>;
    };
    $ERROR_CODES: {
        USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
        FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
        USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
        YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
        YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
        YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
        YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
        YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
        YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
        YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
        YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
        YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
        YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
        BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
        YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
        NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
        YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
        YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
        YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
        YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
        INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
    } & {
        USER_NOT_FOUND: import("better-auth").RawError<"USER_NOT_FOUND">;
        FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
        FAILED_TO_CREATE_SESSION: import("better-auth").RawError<"FAILED_TO_CREATE_SESSION">;
        FAILED_TO_UPDATE_USER: import("better-auth").RawError<"FAILED_TO_UPDATE_USER">;
        FAILED_TO_GET_SESSION: import("better-auth").RawError<"FAILED_TO_GET_SESSION">;
        INVALID_PASSWORD: import("better-auth").RawError<"INVALID_PASSWORD">;
        INVALID_EMAIL: import("better-auth").RawError<"INVALID_EMAIL">;
        INVALID_EMAIL_OR_PASSWORD: import("better-auth").RawError<"INVALID_EMAIL_OR_PASSWORD">;
        INVALID_USER: import("better-auth").RawError<"INVALID_USER">;
        SOCIAL_ACCOUNT_ALREADY_LINKED: import("better-auth").RawError<"SOCIAL_ACCOUNT_ALREADY_LINKED">;
        PROVIDER_NOT_FOUND: import("better-auth").RawError<"PROVIDER_NOT_FOUND">;
        INVALID_TOKEN: import("better-auth").RawError<"INVALID_TOKEN">;
        TOKEN_EXPIRED: import("better-auth").RawError<"TOKEN_EXPIRED">;
        ID_TOKEN_NOT_SUPPORTED: import("better-auth").RawError<"ID_TOKEN_NOT_SUPPORTED">;
        FAILED_TO_GET_USER_INFO: import("better-auth").RawError<"FAILED_TO_GET_USER_INFO">;
        USER_EMAIL_NOT_FOUND: import("better-auth").RawError<"USER_EMAIL_NOT_FOUND">;
        EMAIL_NOT_VERIFIED: import("better-auth").RawError<"EMAIL_NOT_VERIFIED">;
        PASSWORD_TOO_SHORT: import("better-auth").RawError<"PASSWORD_TOO_SHORT">;
        PASSWORD_TOO_LONG: import("better-auth").RawError<"PASSWORD_TOO_LONG">;
        USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
        USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
        EMAIL_CAN_NOT_BE_UPDATED: import("better-auth").RawError<"EMAIL_CAN_NOT_BE_UPDATED">;
        CREDENTIAL_ACCOUNT_NOT_FOUND: import("better-auth").RawError<"CREDENTIAL_ACCOUNT_NOT_FOUND">;
        ACCOUNT_NOT_FOUND: import("better-auth").RawError<"ACCOUNT_NOT_FOUND">;
        SESSION_EXPIRED: import("better-auth").RawError<"SESSION_EXPIRED">;
        FAILED_TO_UNLINK_LAST_ACCOUNT: import("better-auth").RawError<"FAILED_TO_UNLINK_LAST_ACCOUNT">;
        USER_ALREADY_HAS_PASSWORD: import("better-auth").RawError<"USER_ALREADY_HAS_PASSWORD">;
        CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: import("better-auth").RawError<"CROSS_SITE_NAVIGATION_LOGIN_BLOCKED">;
        VERIFICATION_EMAIL_NOT_ENABLED: import("better-auth").RawError<"VERIFICATION_EMAIL_NOT_ENABLED">;
        EMAIL_ALREADY_VERIFIED: import("better-auth").RawError<"EMAIL_ALREADY_VERIFIED">;
        EMAIL_MISMATCH: import("better-auth").RawError<"EMAIL_MISMATCH">;
        SESSION_NOT_FRESH: import("better-auth").RawError<"SESSION_NOT_FRESH">;
        LINKED_ACCOUNT_ALREADY_EXISTS: import("better-auth").RawError<"LINKED_ACCOUNT_ALREADY_EXISTS">;
        INVALID_ORIGIN: import("better-auth").RawError<"INVALID_ORIGIN">;
        INVALID_CALLBACK_URL: import("better-auth").RawError<"INVALID_CALLBACK_URL">;
        INVALID_REDIRECT_URL: import("better-auth").RawError<"INVALID_REDIRECT_URL">;
        INVALID_ERROR_CALLBACK_URL: import("better-auth").RawError<"INVALID_ERROR_CALLBACK_URL">;
        INVALID_NEW_USER_CALLBACK_URL: import("better-auth").RawError<"INVALID_NEW_USER_CALLBACK_URL">;
        MISSING_OR_NULL_ORIGIN: import("better-auth").RawError<"MISSING_OR_NULL_ORIGIN">;
        CALLBACK_URL_REQUIRED: import("better-auth").RawError<"CALLBACK_URL_REQUIRED">;
        FAILED_TO_CREATE_VERIFICATION: import("better-auth").RawError<"FAILED_TO_CREATE_VERIFICATION">;
        FIELD_NOT_ALLOWED: import("better-auth").RawError<"FIELD_NOT_ALLOWED">;
        ASYNC_VALIDATION_NOT_SUPPORTED: import("better-auth").RawError<"ASYNC_VALIDATION_NOT_SUPPORTED">;
        VALIDATION_ERROR: import("better-auth").RawError<"VALIDATION_ERROR">;
        MISSING_FIELD: import("better-auth").RawError<"MISSING_FIELD">;
        METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED: import("better-auth").RawError<"METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED">;
        BODY_MUST_BE_AN_OBJECT: import("better-auth").RawError<"BODY_MUST_BE_AN_OBJECT">;
        PASSWORD_ALREADY_SET: import("better-auth").RawError<"PASSWORD_ALREADY_SET">;
    };
};
//# sourceMappingURL=auth-client.d.ts.map