import Toast from 'react-native-toast-message';

export type NotificationType = 'success' | 'error' | 'info';

export function notify(message: string, type: NotificationType = 'info') {
  if (!message.trim()) return;
  Toast.show({
    type,
    text1: type === 'error' ? 'Something went wrong' : type === 'success' ? 'Done' : 'NearBy',
    text2: message,
    autoHide: true,
    visibilityTime: type === 'error' ? 6000 : 3500,
  });
}
