# Envia um arquivo ZPL "cru" (RAW) para uma impressora do Windows. Mesmo método do print.php do XAMPP.
# Uso: powershell -NoProfile -ExecutionPolicy Bypass -File imprimir-raw.ps1 -Impressora "ELGIN L42PRO FULL" -Arquivo C:\...\etiqueta.zpl
param([Parameter(Mandatory = $true)][string]$Impressora, [Parameter(Mandatory = $true)][string]$Arquivo)
$ErrorActionPreference = 'Stop'
$codigo = @'
using System; using System.Runtime.InteropServices;
public class BrvRaw {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)] public class DI {
    [MarshalAs(UnmanagedType.LPStr)] public string n; [MarshalAs(UnmanagedType.LPStr)] public string o; [MarshalAs(UnmanagedType.LPStr)] public string d; }
  [DllImport("winspool.Drv", CharSet = CharSet.Ansi, SetLastError = true)] public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
  [DllImport("winspool.Drv")] public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.Drv", CharSet = CharSet.Ansi)] public static extern bool StartDocPrinter(IntPtr h, int l, [In] DI di);
  [DllImport("winspool.Drv")] public static extern bool EndDocPrinter(IntPtr h);
  [DllImport("winspool.Drv")] public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.Drv")] public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.Drv")] public static extern bool WritePrinter(IntPtr h, byte[] b, int c, out int w);
  public static void Send(string p, byte[] b) {
    IntPtr h;
    if (!OpenPrinter(p, out h, IntPtr.Zero)) throw new Exception("Impressora '" + p + "' nao encontrada no Windows (erro " + Marshal.GetLastWin32Error() + ")");
    try {
      var di = new DI { n = "Etiqueta BRV Control", d = "RAW" };
      if (!StartDocPrinter(h, 1, di)) throw new Exception("StartDocPrinter falhou");
      StartPagePrinter(h);
      int w; bool ok = WritePrinter(h, b, b.Length, out w);
      EndPagePrinter(h); EndDocPrinter(h);
      if (!ok || w != b.Length) throw new Exception("WritePrinter falhou");
    } finally { ClosePrinter(h); }
  }
}
'@
try {
  Add-Type -TypeDefinition $codigo
  [BrvRaw]::Send($Impressora, [System.IO.File]::ReadAllBytes($Arquivo))
  exit 0
} catch {
  Write-Output $_.Exception.Message
  exit 1
}
