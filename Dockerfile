# A dockerfile is provided

# It is based on a stable distro, example debian

# It produces several images:
# - frontend: contains all apps frontends, served by nginx;
# - backend: contains all apps backends, served by node or deno.

# An entrypoint allows to select the active app.

# The images are published to docker hub.
