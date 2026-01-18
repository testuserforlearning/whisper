export const config = {
    prefix: '/proxy?url=',
    useBase64: true
};

export function flagEnabled(flag: string, base: string) {
    return false;
}

export function codecEncode(str: string) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'utf8').toString('base64');
    }
    return btoa(str);
}

export function codecDecode(str: string) {
    if (typeof Buffer !== 'undefined') {
        return Buffer.from(str, 'base64').toString('utf8');
    }
    return atob(str);
}
