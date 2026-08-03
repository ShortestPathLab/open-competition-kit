"""The Python half of the evaluation protocol.

Injected beside the organiser's program and run instead of it, so that a
competition's evaluation program is a file of plain functions with no argument
parsing, no JSON handling and no knowledge of where anything lives. Everything
in here is the kit's business rather than the organiser's, which is also why it
can change between versions without anybody's `evaluate.py` changing.

The program defines up to three functions:

    def plan(params):              -> a list of cases. Optional.
    def evaluate(case, submission): -> a flat dict of results. Required.
    def reduce(results):           -> the flat dict a leaderboard reads. Optional.

Each runs in its own container. `plan` and `reduce` run with no submission
anywhere near them; `evaluate` runs once per case, with the permitted files of
one submission. Without `plan` there is a single unnamed case, and without
`reduce` the numbers are summed, so the smallest useful program is one function.

Arguments are passed by name, and a function is given only the ones it asks for.
`def evaluate(case)` and `def evaluate(case, params, submission, job)` are both
fine, and a name that is not on offer is an error naming the ones that are.

Print whatever you like. Both streams are the job's log, and the answer travels
by file, so nothing a program or a harness writes can be mistaken for it.
"""

import importlib.util
import inspect
import json
import os
import shutil
import sys
import traceback

REQUEST = "/ock/request.json"
REPLY = "/tmp/ock-reply.json"
WORK = "/ock/work"
PROGRAM = os.path.join(WORK, "program.py")


class Submission(object):
    """The permitted files of one submission, on disk.

    Only the paths the competition allowed. The rest of the archive was
    discarded before this container started, so an edited harness or an extra
    `sitecustomize.py` is not here to be found.
    """

    def __init__(self, root, files):
        self.root = root
        self.files = tuple(files)

    def path(self, name):
        """The absolute path of one submitted file."""
        return os.path.join(self.root, name)

    def read(self, name):
        """One submitted file, as bytes."""
        with open(self.path(name), "rb") as handle:
            return handle.read()

    def copy_into(self, directory):
        """Lay the submission over a directory, keeping its structure.

        What a competition whose image holds a harness wants: the files land on
        top of the copy of the harness in this container, which is thrown away
        with it.
        """
        for name in self.files:
            target = os.path.join(directory, name)
            parent = os.path.dirname(target)
            if parent:
                os.makedirs(parent, exist_ok=True)
            shutil.copyfile(self.path(name), target)
        return directory

    def __repr__(self):
        return "Submission(root=%r, files=%r)" % (self.root, self.files)


def load_program(path):
    spec = importlib.util.spec_from_file_location("ock_program", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("Could not load the evaluation program at %s" % path)
    module = importlib.util.module_from_spec(spec)
    # Registered before it is executed, so a program that imports itself, or
    # that pickles something for a subprocess, finds the module it is inside.
    sys.modules["ock_program"] = module
    spec.loader.exec_module(module)
    return module


def call(function, name, available):
    """Call a function with the subset of `available` it declares.

    Reflection rather than a fixed signature so that the common case stays
    short. Most programs want the case and nothing else, and making them write
    `def evaluate(case, params, submission, job)` to ignore three arguments is
    the kind of ceremony that ends up copied wrong.
    """
    try:
        signature = inspect.signature(function)
    except (TypeError, ValueError):
        return function(**available)

    parameters = signature.parameters.values()

    if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in parameters):
        return function(**available)

    wanted = [
        p.name
        for p in parameters
        if p.kind
        in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
    ]

    unknown = [n for n in wanted if n not in available]
    if unknown:
        raise TypeError(
            "%s() asks for %s, which this phase does not provide. Available: %s."
            % (name, ", ".join(unknown), ", ".join(sorted(available)))
        )

    return function(**{n: available[n] for n in wanted})


def default_reduce(results):
    """Sum the numbers, and count the cases.

    Deliberately the least clever thing that produces a rankable row. Anything
    beyond addition is a scoring decision, and scoring decisions belong in the
    competition's own `reduce` rather than in a default that has to guess.

    Booleans are excluded on purpose: `True + True` is 2 in Python and means
    nothing on a leaderboard.
    """
    total = {}
    for result in results:
        if not isinstance(result, dict):
            continue
        for key, value in result.items():
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                continue
            total[key] = total.get(key, 0) + value
    total["cases"] = len(results)
    return total


def run(request, program):
    phase = request["phase"]
    params = request.get("params") or {}
    job = request.get("job")

    if phase == "plan":
        plan = getattr(program, "plan", None)
        if plan is None:
            # One unnamed case. A competition that does not fan out still goes
            # through every phase, so there is one code path rather than two.
            return [None]
        cases = call(plan, "plan", {"params": params, "job": job})
        if cases is None:
            return [None]
        if not isinstance(cases, (list, tuple)):
            raise TypeError(
                "plan() must return a list of cases, got %s" % type(cases).__name__
            )
        return list(cases)

    if phase == "evaluate":
        evaluate = getattr(program, "evaluate", None)
        if evaluate is None:
            raise AttributeError(
                "The evaluation program defines no evaluate(). It is the one "
                "function a competition has to write."
            )
        source = request.get("submission") or {}
        submission = Submission(source.get("root", ""), source.get("files", []))
        return call(
            evaluate,
            "evaluate",
            {
                "case": request.get("case"),
                "params": params,
                "submission": submission,
                "job": job,
            },
        )

    if phase == "reduce":
        results = request.get("results") or []
        cases = request.get("cases") or []
        reduce_ = getattr(program, "reduce", None)
        if reduce_ is None:
            return default_reduce(results)
        return call(
            reduce_,
            "reduce",
            {
                "results": results,
                "cases": cases,
                "params": params,
                "job": job,
            },
        )

    raise ValueError("Unknown phase %r" % phase)


def main():
    reply_path = REPLY

    if os.path.isdir(WORK):
        # So that a program can import a module the organiser shipped alongside
        # it, and so that a relative open() finds the files that came with it.
        sys.path.insert(0, WORK)
        os.chdir(WORK)

    try:
        with open(REQUEST) as handle:
            request = json.load(handle)
        # The host's path wins over the constant, so the two can disagree during
        # an upgrade without the answer landing where nobody is looking.
        reply_path = request.get("reply") or REPLY
        program = load_program(PROGRAM)
        value = run(request, program)
        payload = {"ok": True, "value": value}
        status = 0
    except BaseException:
        # Reported rather than raised. The traceback belongs in the job's log
        # where a competitor or an organiser can read it, and a bare non-zero
        # exit would leave the host guessing which phase died and why.
        payload = {"ok": False, "error": traceback.format_exc()}
        status = 1

    # `default=str` so that a program returning something JSON has no word for
    # fails as a readable value rather than as a traceback out of the shim. The
    # host checks the shape afterwards and says which key was wrong.
    with open(reply_path, "w") as out:
        json.dump(payload, out, default=str)

    sys.exit(status)


if __name__ == "__main__":
    main()
