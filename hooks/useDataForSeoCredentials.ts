"use client";

import { useState, useEffect } from 'react';

export function useDataForSeoCredentials() {
    const [apiLogin, setApiLogin] = useState<string>("");
    const [apiPassword, setApiPassword] = useState<string>("");

    // Load from localStorage on mount
    useEffect(() => {
        const savedLogin = localStorage.getItem('dataforseo_login');
        const savedPassword = localStorage.getItem('dataforseo_password');

        if (savedLogin) setApiLogin(savedLogin);
        if (savedPassword) setApiPassword(savedPassword);
    }, []);

    // Save to localStorage when values change
    useEffect(() => {
        if (apiLogin) {
            localStorage.setItem('dataforseo_login', apiLogin);
        } else {
            localStorage.removeItem('dataforseo_login');
        }
    }, [apiLogin]);

    useEffect(() => {
        if (apiPassword) {
            localStorage.setItem('dataforseo_password', apiPassword);
        } else {
            localStorage.removeItem('dataforseo_password');
        }
    }, [apiPassword]);

    return {
        apiLogin,
        setApiLogin,
        apiPassword,
        setApiPassword
    };
}
