class NotificationService {
    constructor() {
        this.notifications = new Set();
        this.maxNotifications = 5;
        this.defaultDuration = 4000;
        this.baseZIndex = 400;
        this.notificationHeight = 60;
        this.notificationSpacing = 10;
        this.baseTopPosition = 20;
        
        this.types = {
            'info': { className: 'notification-info', icon: 'ℹ️' },
            'success': { className: 'notification-success', icon: '✅' },
            'warning': { className: 'notification-warning', icon: '⚠️' },
            'error': { className: 'notification-error', icon: '❌' },
            'loading': { className: 'notification-loading', icon: '⏳' }
        };
    }
    
    show(message, type = 'info', duration = null, extraClass = '') {
        if (!message || typeof message !== 'string') return null;
        
        if (duration === null) duration = this.defaultDuration;
        if (!this.types[type]) type = 'info';
        
        this.cleanupOldNotifications();
        
        const notification = this.createNotificationElement(message, type, extraClass);
        const position = this.calculatePosition();
        
        this.setNotificationPosition(notification, position);
        this.setupEnterAnimation(notification);
        
        document.body.appendChild(notification);
        this.notifications.add(notification);
        
        this.animateIn(notification);
        
        if (duration > 0) {
            setTimeout(() => this.remove(notification), duration);
        }
        
        notification.addEventListener('click', () => this.remove(notification));
        
        return notification;
    }
    
    createNotificationElement(message, type, extraClass) {
        const notification = document.createElement('div');
        notification.className = `notification ${type} ${extraClass}`.trim();
        notification.setAttribute('data-notification-type', type);
        notification.setAttribute('data-timestamp', Date.now());
        notification.textContent = message;
        return notification;
    }
    
    calculatePosition() {
        const existingNotifications = Array.from(this.notifications).filter(n => n.isConnected);
        let topPosition = this.baseTopPosition;
        
        existingNotifications.forEach(existing => {
            const currentTop = parseInt(existing.style.top) || this.baseTopPosition;
            const height = this.getNotificationHeight(existing);
            topPosition = Math.max(topPosition, currentTop + height + this.notificationSpacing);
        });
        
        return { top: topPosition, right: 20 };
    }
    
    getNotificationHeight(notification) {
        if (!notification || !notification.isConnected) {
            return this.notificationHeight;
        }
        
        const rect = notification.getBoundingClientRect();
        if (rect.height > 0) {
            return rect.height;
        }
        
        const computedStyle = window.getComputedStyle(notification);
        const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        const lineHeight = parseFloat(computedStyle.lineHeight) || 20;
        const estimatedHeight = paddingTop + paddingBottom + lineHeight;
        
        return Math.max(estimatedHeight, this.notificationHeight);
    }
    
    setNotificationPosition(notification, position) {
        Object.assign(notification.style, {
            position: 'fixed',
            top: position.top + 'px',
            right: position.right + 'px',
            zIndex: this.baseZIndex + this.notifications.size
        });
    }
    
    setupEnterAnimation(notification) {
        Object.assign(notification.style, {
            transform: 'translateX(100%) translateZ(0)',
            opacity: '0',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            willChange: 'transform, opacity'
        });
    }
    
    animateIn(notification) {
        requestAnimationFrame(() => {
            Object.assign(notification.style, {
                transform: 'translateX(0) translateZ(0)',
                opacity: '1'
            });
            
            setTimeout(() => {
                if (notification.isConnected) {
                    notification.style.transition = '';
                    notification.style.willChange = 'auto';
                }
            }, 400);
        });
    }
    
    remove(notification) {
        if (!notification || !notification.isConnected) return;
        
        notification.setAttribute('data-removing', 'true');
        
        Object.assign(notification.style, {
            transition: 'transform 0.3s ease-out, opacity 0.3s ease-out',
            transform: 'translateX(100%) translateZ(0)',
            opacity: '0',
            pointerEvents: 'none'
        });
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
            this.notifications.delete(notification);
            
            requestAnimationFrame(() => {
                this._repositionNotifications();
            });
        }, 300);
    }
    
    _repositionNotifications() {
        const activeNotifications = Array.from(this.notifications).filter(n => 
            n.isConnected && !n.getAttribute('data-removing')
        );
        
        if (activeNotifications.length === 0) return;
        
        let cumulativeTop = this.baseTopPosition;
        
        activeNotifications.forEach((notification, index) => {
            const currentTop = parseInt(notification.style.top) || this.baseTopPosition;
            const newTop = cumulativeTop;
            
            if (Math.abs(currentTop - newTop) > 1) {
                this.animateNotificationPosition(notification, newTop);
            }
            
            const height = this.getNotificationHeight(notification);
            cumulativeTop = newTop + height + this.notificationSpacing;
        });
    }
    
    animateNotificationPosition(notification, newTop) {
        const currentTop = parseInt(notification.style.top) || this.baseTopPosition;
        const distance = Math.abs(newTop - currentTop);
        
        const duration = Math.min(350, Math.max(150, distance * 1.5));
        const easing = 'cubic-bezier(0.4, 0.0, 0.2, 1)';
        
        notification.style.willChange = 'top';
        notification.style.transition = `top ${duration}ms ${easing}`;
        notification.style.top = newTop + 'px';
        
        setTimeout(() => {
            if (notification.isConnected && !notification.getAttribute('data-removing')) {
                notification.style.transition = '';
                notification.style.willChange = 'auto';
            }
        }, duration + 50);
    }
    
    cleanupOldNotifications() {
        const activeNotifications = Array.from(this.notifications).filter(n => n.isConnected);
        
        if (activeNotifications.length >= this.maxNotifications) {
            const oldestNotifications = activeNotifications
                .sort((a, b) => {
                    const timestampA = parseInt(a.getAttribute('data-timestamp')) || 0;
                    const timestampB = parseInt(b.getAttribute('data-timestamp')) || 0;
                    return timestampA - timestampB;
                })
                .slice(0, activeNotifications.length - this.maxNotifications + 1);
                
            oldestNotifications.forEach(notification => this.remove(notification));
        }
        
        this.notifications.forEach(notification => {
            if (!notification.isConnected) {
                this.notifications.delete(notification);
            }
        });
    }
    
    clearAll() {
        Array.from(this.notifications)
            .filter(n => n.isConnected)
            .forEach(notification => this.remove(notification));
    }
    
    getActiveCount() {
        return Array.from(this.notifications).filter(n => n.isConnected).length;
    }
    
    showNotification(message, type, duration, extraClass) {
        return this.show(message, type, duration, extraClass);
    }
    
    repositionNotifications() {
        this._repositionNotifications();
    }
    
    removeNotification(notification) {
        this.remove(notification);
    }
    
    removeNotificationAnimated(notification, callback) {
        this.remove(notification);
        if (callback && typeof callback === 'function') {
            setTimeout(callback, 300);
        }
    }
    
    removeMultiple(notifications, callback = null) {
        if (!notifications || notifications.length === 0) {
            if (callback) callback();
            return;
        }

        let completed = 0;
        const total = notifications.length;
        const areTutorialNotifications = notifications.some(n => n.classList.contains('tutorial-notification'));
        
        Array.from(notifications).forEach((notification, index) => {
            const delay = areTutorialNotifications ? index * 80 : index * 50;
            
            setTimeout(() => {
                this.remove(notification);
                completed++;
                if (completed === total && callback) {
                    setTimeout(callback, 100);
                }
            }, delay);
        });
    }
    
    removeWithoutReposition(notification, callback = null) {
        if (notification && this.notifications.has(notification)) {
            Object.assign(notification.style, {
                transition: 'transform 0.3s cubic-bezier(0.55, 0.085, 0.68, 0.53), opacity 0.2s ease',
                transform: 'translateX(100%) translateZ(0)',
                opacity: '0.8'
            });
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
                this.notifications.delete(notification);
                if (callback) callback();
            }, 300);
        } else if (callback) {
            callback();
        }
    }
    
    reposition() {
        this._repositionNotifications();
    }
}

const notificationService = new NotificationService();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationService;
}

window.NotificationService = NotificationService;
window.notificationService = notificationService;

window.showNotification = (message, type, duration, extraClass) => 
    notificationService.show(message, type, duration, extraClass);
    
window.repositionNotifications = () => 
    notificationService._repositionNotifications();
    
window.removeNotification = (notification) => 
    notificationService.remove(notification);
    
window.removeNotificationAnimated = (notification, callback) => 
    notificationService.removeNotificationAnimated(notification, callback);
    
window.removeMultipleNotificationsAnimated = (notifications, callback) => 
    notificationService.removeMultiple(notifications, callback);
    
window.removeNotificationAnimatedWithoutReposition = (notification, callback) => 
    notificationService.removeWithoutReposition(notification, callback);