/// <reference types="w3c-web-usb" />

'use client';

/**
 * Wrapper fino sobre a WebUSB API pra falar direto com a Epson TM-T20X
 * ligada por cabo USB (sem impressora na rede, ePOS-Print não se aplica).
 * Suportado em Chrome/Edge; não existe em Safari/Firefox.
 *
 * A referência explícita acima é necessária porque `@types/w3c-web-usb` não
 * é incluído automaticamente neste projeto (não é um pacote npm de verdade,
 * é só definição de tipos — a inclusão automática do TS não o pega).
 */

export const EPSON_VENDOR_ID = 0x04b8;

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/** Dispositivos já autorizados antes (pareamento persiste por origem). */
export async function findPairedPrinter(): Promise<USBDevice | null> {
  if (!isWebUsbSupported()) return null;
  const devices = await navigator.usb.getDevices();
  return (
    devices.find((device) => device.vendorId === EPSON_VENDOR_ID) ?? null
  );
}

/**
 * Pede autorização pro usuário escolher a impressora. Só funciona chamada
 * direto da pilha de um clique — nenhum `await` antes dela na cadeia de
 * chamada, senão o Chrome recusa por falta de gesto do usuário.
 */
export async function requestPrinterPairing(): Promise<USBDevice> {
  return navigator.usb.requestDevice({
    filters: [{ vendorId: EPSON_VENDOR_ID }],
  });
}

function findBulkOutEndpoint(device: USBDevice): {
  configurationValue: number;
  interfaceNumber: number;
  endpointNumber: number;
} | null {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alternate of iface.alternates) {
        const endpoint = alternate.endpoints.find(
          (item) => item.direction === 'out' && item.type === 'bulk',
        );
        if (endpoint) {
          return {
            configurationValue: config.configurationValue,
            interfaceNumber: iface.interfaceNumber,
            endpointNumber: endpoint.endpointNumber,
          };
        }
      }
    }
  }
  return null;
}

/**
 * Abre, envia os bytes e fecha de novo — não mantém o dispositivo
 * reivindicado entre impressões, mais simples e robusto (não corre risco de
 * ficar com a interface presa se a aba recarregar no meio).
 */
export async function printBytes(
  device: USBDevice,
  bytes: Uint8Array,
): Promise<void> {
  const endpoint = findBulkOutEndpoint(device);
  if (!endpoint) throw new Error('Endpoint de impressão não encontrado.');

  await device.open();
  try {
    await device.selectConfiguration(endpoint.configurationValue);
    await device.claimInterface(endpoint.interfaceNumber);
    try {
      await device.transferOut(endpoint.endpointNumber, bytes as BufferSource);
    } finally {
      await device.releaseInterface(endpoint.interfaceNumber);
    }
  } finally {
    await device.close();
  }
}
