/* Theseus gateway helper.
 *
 * macOS does not let launchd jobs read files on external volumes unless the
 * job's program has Full Disk Access. Granting that to /bin/bash would extend
 * it to every background bash script, so `theseus-gateway install` builds this
 * helper per host ship instead, and the user grants access to it alone.
 *
 * The helper runs exactly one script (GW_SCRIPT) with one of its commands, in
 * a fixed environment compiled in at install time: callers cannot choose the
 * script, the pier, or variables such as BASH_ENV. Child processes inherit the
 * helper's permission, as commands run from Terminal inherit Terminal's.
 */
#include <errno.h>
#include <signal.h>
#include <spawn.h>
#include <stdio.h>
#include <string.h>
#include <sys/wait.h>

#if !defined(GW_SCRIPT) || !defined(GW_PATH) || !defined(GW_HOME) || \
    !defined(GW_PIER) || !defined(GW_SHIP) || !defined(GW_WEB_BIND) || \
    !defined(GW_WEB_BASE) || !defined(GW_ADMIN) || !defined(GW_CADDY)
#error "build with ops/theseus-gateway install"
#endif

static pid_t child = 0;

static void forward(int sig) {
  if (child > 0) kill(child, sig);
}

int main(int argc, char **argv) {
  if (argc != 2 || (strcmp(argv[1], "run") && strcmp(argv[1], "sync") &&
                    strcmp(argv[1], "check"))) {
    fprintf(stderr, "usage: %s run|sync|check\n", argv[0]);
    return 2;
  }

  char *args[] = {"/bin/bash", GW_SCRIPT, argv[1], NULL};
  char *envp[] = {
    "PATH=" GW_PATH,
    "HOME=" GW_HOME,
    "LANG=C",
    "THESEUS_PIER=" GW_PIER,
    "THESEUS_SHIP=" GW_SHIP,
    "THESEUS_WEB_BIND=" GW_WEB_BIND,
    "THESEUS_WEB_BASE=" GW_WEB_BASE,
    "THESEUS_ADMIN=" GW_ADMIN,
    "CADDY=" GW_CADDY,
    NULL,
  };

  /* launchd stops the job with SIGTERM; pass it on so the gateway can shut
   * down Caddy gracefully and report itself down to Theseus. */
  struct sigaction sa;
  memset(&sa, 0, sizeof sa);
  sa.sa_handler = forward;
  sigaction(SIGTERM, &sa, NULL);
  sigaction(SIGINT, &sa, NULL);
  sigaction(SIGHUP, &sa, NULL);

  int err = posix_spawn(&child, "/bin/bash", NULL, NULL, args, envp);
  if (err) {
    fprintf(stderr, "theseus-gateway-helper: spawn: %s\n", strerror(err));
    return 1;
  }

  int status = 0;
  while (waitpid(child, &status, 0) < 0) {
    if (errno != EINTR) {
      perror("theseus-gateway-helper: waitpid");
      return 1;
    }
  }
  return WIFEXITED(status) ? WEXITSTATUS(status) : 128 + WTERMSIG(status);
}
