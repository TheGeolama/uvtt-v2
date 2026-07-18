export const uiStore = createUIStore();

function createUIStore() {
    let toasts = $state([]);
    let isLoading = $state(false);
    let loadingMessage = $state("");

    return {
        get toasts() { return toasts; },
        get isLoading() { return isLoading; },
        get loadingMessage() { return loadingMessage; },

        addToast(message, type = 'info', duration = 4000) {
            const id = crypto.randomUUID();
            toasts = [...toasts, { id, message, type }];
            
            // Auto-dismiss
            setTimeout(() => {
                this.removeToast(id);
            }, duration);
        },

        removeToast(id) {
            toasts = toasts.filter(t => t.id !== id);
        },

        setLoading(loading, message = "Processing...") {
            isLoading = loading;
            loadingMessage = message;
        }
    };
}