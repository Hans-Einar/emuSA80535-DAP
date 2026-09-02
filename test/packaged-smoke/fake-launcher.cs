using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

internal static class FakeLauncher
{
    private static int Main(string[] args)
    {
        string node = Environment.GetEnvironmentVariable("EMU_SMOKE_NODE");
        string server = Environment.GetEnvironmentVariable("EMU_SMOKE_SERVER");
        if (String.IsNullOrEmpty(node) || String.IsNullOrEmpty(server))
        {
            Console.Error.WriteLine("EMU_SMOKE_NODE and EMU_SMOKE_SERVER are required");
            return 64;
        }

        var arguments = new StringBuilder(QuoteArgument(server));
        foreach (string argument in args)
        {
            arguments.Append(' ');
            arguments.Append(QuoteArgument(argument));
        }
        IntPtr standardInput = DuplicateStandardHandle(-10);
        IntPtr standardOutput = DuplicateStandardHandle(-11);
        IntPtr standardError = DuplicateStandardHandle(-12);
        var startup = new StartupInfo
        {
            Size = Marshal.SizeOf(typeof(StartupInfo)),
            Flags = 0x00000100,
            StandardInput = standardInput,
            StandardOutput = standardOutput,
            StandardError = standardError,
        };
        var commandLine = new StringBuilder(QuoteArgument(node));
        commandLine.Append(' ');
        commandLine.Append(arguments);
        ProcessInformation processInformation;
        try
        {
            if (!CreateProcess(
                node,
                commandLine,
                IntPtr.Zero,
                IntPtr.Zero,
                true,
                0,
                IntPtr.Zero,
                null,
                ref startup,
                out processInformation))
            {
                throw new Win32Exception(Marshal.GetLastWin32Error());
            }
        }
        finally
        {
            CloseHandle(standardInput);
            CloseHandle(standardOutput);
            CloseHandle(standardError);
        }
        CloseHandle(processInformation.Thread);
        WaitForSingleObject(processInformation.Process, 0xffffffff);
        uint exitCode;
        if (!GetExitCodeProcess(processInformation.Process, out exitCode))
        {
            CloseHandle(processInformation.Process);
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        CloseHandle(processInformation.Process);
        return unchecked((int)exitCode);
    }

    private static IntPtr DuplicateStandardHandle(int identifier)
    {
        IntPtr currentProcess = GetCurrentProcess();
        IntPtr duplicate;
        if (!DuplicateHandle(
            currentProcess,
            GetStdHandle(identifier),
            currentProcess,
            out duplicate,
            0,
            true,
            0x00000002))
        {
            throw new Win32Exception(Marshal.GetLastWin32Error());
        }
        return duplicate;
    }

    private static string QuoteArgument(string argument)
    {
        if (argument.Length > 0 && argument.IndexOfAny(new[] { ' ', '\t', '\n', '\v', '"' }) < 0)
        {
            return argument;
        }
        var quoted = new StringBuilder("\"");
        int backslashes = 0;
        foreach (char character in argument)
        {
            if (character == '\\')
            {
                backslashes++;
            }
            else if (character == '"')
            {
                quoted.Append('\\', backslashes * 2 + 1);
                quoted.Append(character);
                backslashes = 0;
            }
            else
            {
                quoted.Append('\\', backslashes);
                quoted.Append(character);
                backslashes = 0;
            }
        }
        quoted.Append('\\', backslashes * 2);
        quoted.Append('"');
        return quoted.ToString();
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct StartupInfo
    {
        public int Size;
        public string Reserved;
        public string Desktop;
        public string Title;
        public int X;
        public int Y;
        public int XSize;
        public int YSize;
        public int XCountChars;
        public int YCountChars;
        public int FillAttribute;
        public int Flags;
        public short ShowWindow;
        public short Reserved2;
        public IntPtr ReservedPointer;
        public IntPtr StandardInput;
        public IntPtr StandardOutput;
        public IntPtr StandardError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr Process;
        public IntPtr Thread;
        public int ProcessId;
        public int ThreadId;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    private static extern bool CreateProcess(
        string applicationName,
        StringBuilder commandLine,
        IntPtr processAttributes,
        IntPtr threadAttributes,
        bool inheritHandles,
        int creationFlags,
        IntPtr environment,
        string currentDirectory,
        ref StartupInfo startupInfo,
        out ProcessInformation processInformation);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool DuplicateHandle(
        IntPtr sourceProcess,
        IntPtr sourceHandle,
        IntPtr targetProcess,
        out IntPtr targetHandle,
        int desiredAccess,
        bool inheritHandle,
        int options);

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetCurrentProcess();

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr GetStdHandle(int identifier);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern int WaitForSingleObject(IntPtr handle, uint milliseconds);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetExitCodeProcess(IntPtr process, out uint exitCode);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);
}
