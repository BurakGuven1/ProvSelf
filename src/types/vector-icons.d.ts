declare module '@expo/vector-icons/Ionicons' {
  import type { Icon } from '@expo/vector-icons/build/createIconSet';
  import type { ComponentProps } from 'react';

  const Ionicons: Icon<string, string>;
  export default Ionicons;
  export type IoniconsProps = ComponentProps<typeof Ionicons>;
}
