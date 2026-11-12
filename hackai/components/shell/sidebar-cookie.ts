/* La cookie donde queda si la barra lateral está plegada. Va en un módulo
   aparte porque la leen el layout de (app), en el servidor, y la barra, en el
   navegador: exportada desde un componente de cliente, al servidor le llegaría
   una referencia y no el texto. */
export const SIDEBAR_COOKIE = 'hackai_sidebar'
